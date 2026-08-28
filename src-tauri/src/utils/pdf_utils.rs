use krilla::{Document, Data};
use krilla::page::PageSettings;
use krilla::image::Image;
use krilla::geom::{Size, Transform};
use rayon::prelude::*;
use std::sync::Arc;
use image::{DynamicImage, GenericImageView, ImageFormat as ImgFormat, RgbaImage};
use ts_rs::TS;

/// MM to points conversion factor
const MM_TO_POINTS: f32 = 2.83465;

/// Card image with positioning and bleed info for cropping
#[derive(Debug, Clone)]
pub struct CardImagePosition {
    pub file_path: String,
    /// Cell X position in points (top-left of grid cell)
    pub cell_x: f32,
    /// Cell Y position in points (top-left of grid cell)
    pub cell_y: f32,
    /// Cell width in points (cardWidth + 2*outputBleed)
    pub cell_width: f32,
    /// Cell height in points (cardHeight + 2*outputBleed)
    pub cell_height: f32,
    /// Source image bleed in mm (how much bleed is in the source image)
    pub source_bleed_mm: f32,
    /// Output bleed in mm (how much bleed to keep)
    pub output_bleed_mm: f32,
    /// Card width in mm (without bleed)
    pub card_width_mm: f32,
    /// Card height in mm (without bleed)
    pub card_height_mm: f32,
}

/// Result of cropping an image - includes the image and its actual dimensions in mm
struct CroppedImageResult {
    image: Image,
    width_mm: f32,
    height_mm: f32,
}


/// An embedded image that doesn't require file system access
#[derive(Debug, Clone)]
pub struct EmbeddedImage {
    pub data: &'static [u8],
    pub format: ImageFormat,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum ImageFormat {
    Jpeg,
    Png,
}

#[derive(Debug, Clone)]
pub struct PageLayout {
    pub width: f32,
    pub height: f32,
    /// Card images with bleed cropping info
    pub card_images: Vec<CardImagePosition>,
    /// Optional embedded background image (e.g., registration marks)
    pub background: Option<EmbeddedImage>,
}

/// One card that could not be rendered, and why.
#[derive(Debug, Clone, serde::Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct SkippedImage {
    pub file_path: String,
    pub reason: String,
}

/// Result of a generation run. A run can succeed while individual cards fail.
#[derive(Debug, Clone, serde::Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct PdfGenerationOutcome {
    pub output_path: String,
    pub skipped: Vec<SkippedImage>,
}

#[derive(Debug, Clone)]
pub struct PdfGenerationRequest {
    pub pages: Vec<PageLayout>,
    pub output_path: String,
}

/// Identifies a prepared image by everything that changes how it is cropped.
///
/// Card dimensions are part of it because the crop is computed as a proportion
/// of the card, so the same file at a different card size is a different image.
fn image_key(card: &CardImagePosition) -> String {
    format!(
        "{}:{}:{}:{}x{}",
        card.file_path,
        card.source_bleed_mm,
        card.output_bleed_mm,
        card.card_width_mm,
        card.card_height_mm
    )
}

/// Generates a PDF with images positioned on pages using Krilla with Rayon for parallel processing
///
/// This function handles bleed cropping similar to pdfWorker.ts:
/// - Each card image has a source_bleed_mm (bleed in the original image)
/// - Each card has an output_bleed_mm (how much bleed to keep in output)
/// - Images are cropped by (source_bleed - output_bleed) from each side
pub async fn generate_pdf<F>(
    request: PdfGenerationRequest,
    on_progress: F,
) -> Result<PdfGenerationOutcome, String>
where
    F: Fn(usize, usize) + Sync + Send,
{
    // Validate input
    if request.pages.is_empty() {
        return Err("No pages provided".to_string());
    }

    // Collect all unique image paths across all pages
    let all_card_images: Vec<CardImagePosition> = request
        .pages
        .iter()
        .flat_map(|page| page.card_images.clone())
        .collect();

    log::info!("Starting PDF generation with {} pages and {} total card images",
        request.pages.len(), all_card_images.len());

    // =====================================================
    // STEP 1: Load and crop all images in parallel
    // =====================================================
    // The same artwork placed several times only needs decoding once. Card lists
    // are full of duplicates, and this used to crop every copy and then discard
    // all but one of the results.
    let mut unique: std::collections::HashMap<String, &CardImagePosition> =
        std::collections::HashMap::new();
    for card_img in &all_card_images {
        unique.entry(image_key(card_img)).or_insert(card_img);
    }

    let unique_images: Vec<(String, &CardImagePosition)> = unique.into_iter().collect();
    let total = unique_images.len();
    log::info!("{} unique images to prepare ({} placements)", total, all_card_images.len());

    let completed = std::sync::atomic::AtomicUsize::new(0);
    let prepared: Vec<(String, String, Result<CroppedImageResult, String>)> = unique_images
        .par_iter()
        .map(|(key, card_img)| {
            let result = load_and_crop_image(card_img);
            let done = completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            on_progress(done, total);
            (key.clone(), card_img.file_path.clone(), result)
        })
        .collect();

    // A single unreadable file should cost you that card, not the whole run -
    // one bad download in a sixty-card list used to produce no PDF at all.
    let mut image_map: std::collections::HashMap<String, CroppedImageResult> =
        std::collections::HashMap::new();
    let mut skipped: Vec<SkippedImage> = Vec::new();

    for (key, file_path, result) in prepared {
        match result {
            Ok(cropped_result) => {
                image_map.insert(key, cropped_result);
            }
            Err(e) => {
                log::error!("Skipping image: {}", e);
                if !skipped.iter().any(|s| s.file_path == file_path) {
                    skipped.push(SkippedImage { file_path, reason: e });
                }
            }
        }
    }

    // Nothing rendered at all is a failure, not a partial success.
    if image_map.is_empty() && !all_card_images.is_empty() {
        return Err(format!(
            "None of the {} card images could be read. First problem: {}",
            all_card_images.len(),
            skipped.first().map(|s| s.reason.as_str()).unwrap_or("unknown")
        ));
    }

    log::info!(
        "Loaded and cropped {} unique images, skipped {}",
        image_map.len(),
        skipped.len()
    );

    // =====================================================
    // STEP 2: Create PDF document and add pages
    // =====================================================
    let mut document = Document::new();

    for (page_idx, page_layout) in request.pages.iter().enumerate() {
        log::info!("Creating page {} with dimensions {}x{}",
            page_idx + 1, page_layout.width, page_layout.height);

        let page_size = Size::from_wh(page_layout.width, page_layout.height)
            .ok_or_else(|| format!("Invalid page dimensions: {}x{}", page_layout.width, page_layout.height))?;

        let mut page = document.start_page_with(
            PageSettings::new(page_size)
        );
        let mut surface = page.surface();

        // Draw background image first (e.g., registration marks)
        if let Some(bg) = &page_layout.background {
            let bg_image = load_image_from_bytes(bg.data, bg.format)
                .map_err(|e| format!("Failed to load background image: {}", e))?;

            surface.push_transform(&Transform::from_translate(bg.x, bg.y));
            if let Some(size) = Size::from_wh(bg.width, bg.height) {
                surface.draw_image(bg_image, size);
            }
            surface.pop();
        }

        // Draw card images on top
        for card_img in &page_layout.card_images {
            let key = image_key(card_img);

            if let Some(cropped_result) = image_map.get(&key) {
                // Convert cropped image dimensions from mm to points
                let image_width_pts = cropped_result.width_mm * MM_TO_POINTS;
                let image_height_pts = cropped_result.height_mm * MM_TO_POINTS;

                // Center the cropped image within its cell (matching pdfWorker.ts logic)
                let offset_x = card_img.cell_x + (card_img.cell_width - image_width_pts) / 2.0;
                let offset_y = card_img.cell_y + (card_img.cell_height - image_height_pts) / 2.0;

                // Apply transform for positioning
                surface.push_transform(&Transform::from_translate(offset_x, offset_y));

                // Draw image at the actual cropped size
                if let Some(size) = Size::from_wh(image_width_pts, image_height_pts) {
                    surface.draw_image(cropped_result.image.clone(), size);
                } else {
                    log::warn!("Invalid image dimensions: {}x{}", image_width_pts, image_height_pts);
                }

                surface.pop();
            } else {
                log::warn!("Image not found in map: {}", key);
            }
        }

        surface.finish();
        page.finish();
    }

    // =====================================================
    // STEP 3: Finalize PDF and write to file
    // =====================================================
    log::info!("Finalizing PDF...");
    let pdf_bytes = document.finish()
        .map_err(|e| format!("Failed to finalize PDF: {:?}", e))?;

    std::fs::write(&request.output_path, pdf_bytes)
        .map_err(|e| format!("Failed to write PDF to {}: {}", request.output_path, e))?;

    log::info!("PDF generated successfully at {}", request.output_path);
    Ok(PdfGenerationOutcome {
        output_path: request.output_path.clone(),
        skipped,
    })
}

/// Load and crop an image based on bleed settings
///
/// This mimics the cropImageBleed function from pdfWorker.ts:
/// - The source image includes bleed area
/// - We crop (source_bleed - output_bleed) from each side
/// - Returns the cropped image AND its actual dimensions in mm
fn load_and_crop_image(card_img: &CardImagePosition) -> Result<CroppedImageResult, String> {
    // Load the image using the image crate for manipulation
    // Detect the format from the file contents, not the extension: MPCFill names
    // downloads from Drive metadata, so a ".png" is frequently really a JPEG.
    let img = image::ImageReader::open(&card_img.file_path)
        .map_err(|e| format!("Failed to open image {}: {}", card_img.file_path, e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect format of {}: {}", card_img.file_path, e))?
        .decode()
        .map_err(|e| format!("Failed to decode image {}: {}", card_img.file_path, e))?;

    let (img_width, img_height) = img.dimensions();

    // The source image represents: cardWidth + (sourceBleed * 2) x cardHeight + (sourceBleed * 2) in mm
    let total_card_width_mm = card_img.card_width_mm + (card_img.source_bleed_mm * 2.0);
    let total_card_height_mm = card_img.card_height_mm + (card_img.source_bleed_mm * 2.0);

    // Calculate effective crop: how much to remove from each side (bleed - outputBleed)
    let effective_crop_mm = card_img.source_bleed_mm - card_img.output_bleed_mm;

    // Calculate crop percentage (portion of image to remove from each side)
    let crop_percent_x = effective_crop_mm / total_card_width_mm;
    let crop_percent_y = effective_crop_mm / total_card_height_mm;

    // Calculate pixels to crop from each side
    let crop_left_px = (img_width as f32 * crop_percent_x).round() as i32;
    let crop_top_px = (img_height as f32 * crop_percent_y).round() as i32;

    // Calculate cropped dimensions in pixels
    let cropped_width_px = (img_width as i32 - (crop_left_px * 2)).max(1) as u32;
    let cropped_height_px = (img_height as i32 - (crop_top_px * 2)).max(1) as u32;

    // Calculate the actual dimensions of the cropped image in mm
    // Based on the pixel ratio: source image represents totalCardWidthMm x totalCardHeightMm
    let cropped_width_mm = (cropped_width_px as f32 / img_width as f32) * total_card_width_mm;
    let cropped_height_mm = (cropped_height_px as f32 / img_height as f32) * total_card_height_mm;

    log::debug!(
        "Cropping image: {}x{}px -> {}x{}px (crop {}px from each side), result: {:.2}x{:.2}mm",
        img_width, img_height, cropped_width_px, cropped_height_px, crop_left_px, cropped_width_mm, cropped_height_mm
    );

    // Positive crop on both axes is the common case (source bleed exceeds output
    // bleed), so take the cheap path. A negative crop on either axis means the
    // output bleed is larger than what the source image carries, and we extend the
    // outermost pixels outward to fill the difference with real ink.
    let cropped_img = if crop_left_px >= 0 && crop_top_px >= 0 {
        if crop_left_px > 0 || crop_top_px > 0 {
            img.crop_imm(
                crop_left_px as u32,
                crop_top_px as u32,
                cropped_width_px,
                cropped_height_px,
            )
        } else {
            // Source bleed exactly matches output bleed - nothing to do
            img
        }
    } else {
        resample_clamped(&img, cropped_width_px, cropped_height_px, crop_left_px, crop_top_px)
    };

    // Encoded losslessly on purpose. Source art runs to 3264x4440 - about
    // 1300 DPI across a 63mm card - and half of it arrives as lossless PNG, so
    // re-encoding as JPEG would throw away real detail. Measurement says it
    // buys almost nothing: at opt-level 3, PNG costs ~139ms per card against
    // ~117ms for JPEG q92 (see benchmark_encoders_at_card_resolution). The
    // export was slow because dependencies were built unoptimized, not because
    // of this.
    let mut png_bytes: Vec<u8> = Vec::new();
    cropped_img
        .write_to(&mut std::io::Cursor::new(&mut png_bytes), ImgFormat::Png)
        .map_err(|e| format!("Failed to encode cropped image as PNG: {}", e))?;

    let data: Data = Arc::new(png_bytes).into();
    let image = Image::from_png(data, false)
        .map_err(|e| format!("Failed to create krilla image: {}", e))?;

    Ok(CroppedImageResult {
        image,
        width_mm: cropped_width_mm,
        height_mm: cropped_height_mm,
    })
}

/// Build a `dst_width` x `dst_height` image by sampling the source with
/// clamp-to-edge addressing.
///
/// `offset_x`/`offset_y` are the source coordinates that map to destination
/// (0, 0): positive values crop, negative values pad. Because sampling clamps,
/// the padded region repeats the outermost row/column of the source, giving the
/// artificial bleed real ink rather than empty space. Corners fall out of the
/// same clamp and repeat the corner pixel.
///
/// NOTE: this is deliberately Rust-only. The web pipeline (pdfWorker.ts) pads a
/// negative crop with transparency instead, so desktop output carries bleed ink
/// where web output leaves white.
fn resample_clamped(
    img: &DynamicImage,
    dst_width: u32,
    dst_height: u32,
    offset_x: i32,
    offset_y: i32,
) -> DynamicImage {
    let src = img.to_rgba8();
    let max_x = src.width() as i32 - 1;
    let max_y = src.height() as i32 - 1;

    let mut out = RgbaImage::new(dst_width, dst_height);
    for y in 0..dst_height {
        let sy = (y as i32 + offset_y).clamp(0, max_y) as u32;
        for x in 0..dst_width {
            let sx = (x as i32 + offset_x).clamp(0, max_x) as u32;
            out.put_pixel(x, y, *src.get_pixel(sx, sy));
        }
    }

    DynamicImage::ImageRgba8(out)
}

/// Load an image from embedded bytes with a specified format
fn load_image_from_bytes(bytes: &[u8], format: ImageFormat) -> Result<Image, String> {
    let data: Data = Arc::new(bytes.to_vec()).into();

    match format {
        ImageFormat::Jpeg => Image::from_jpeg(data, false)
            .map_err(|e| format!("JPEG decode error: {}", e)),
        ImageFormat::Png => Image::from_png(data, false)
            .map_err(|e| format!("PNG decode error: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    /// A 2x2 source padded by 1px on every side should repeat its edge pixels
    /// outward, and each corner should fill its quadrant.
    #[test]
    fn resample_clamped_extends_edges() {
        let mut src = RgbaImage::new(2, 2);
        let a = Rgba([1, 0, 0, 255]);
        let b = Rgba([2, 0, 0, 255]);
        let c = Rgba([3, 0, 0, 255]);
        let d = Rgba([4, 0, 0, 255]);
        src.put_pixel(0, 0, a);
        src.put_pixel(1, 0, b);
        src.put_pixel(0, 1, c);
        src.put_pixel(1, 1, d);

        let out = resample_clamped(&DynamicImage::ImageRgba8(src), 4, 4, -1, -1).to_rgba8();

        assert_eq!(out.dimensions(), (4, 4));
        let expected = [
            [a, a, b, b],
            [a, a, b, b],
            [c, c, d, d],
            [c, c, d, d],
        ];
        for (y, row) in expected.iter().enumerate() {
            for (x, want) in row.iter().enumerate() {
                assert_eq!(out.get_pixel(x as u32, y as u32), want, "at ({}, {})", x, y);
            }
        }
    }

    fn card_at(path: &str) -> CardImagePosition {
        CardImagePosition {
            file_path: path.to_string(),
            cell_x: 0.0,
            cell_y: 0.0,
            cell_width: 180.0,
            cell_height: 250.0,
            source_bleed_mm: 0.0,
            output_bleed_mm: 0.0,
            card_width_mm: 63.0,
            card_height_mm: 88.0,
        }
    }

    fn request_for(dir: &std::path::Path, cards: Vec<CardImagePosition>) -> PdfGenerationRequest {
        PdfGenerationRequest {
            pages: vec![PageLayout {
                width: 800.0,
                height: 600.0,
                card_images: cards,
                background: None,
            }],
            output_path: dir.join("out.pdf").to_string_lossy().into_owned(),
        }
    }

    /// Encoding cost at a realistic card size, to decide what the PDF should
    /// carry. Run with: cargo test -- --ignored --nocapture
    #[test]
    #[ignore]
    fn benchmark_encoders_at_card_resolution() {
        use std::time::Instant;

        // 2192x2992 is what MPC Autofill PNG art actually is (~884 DPI).
        let mut img = image::RgbImage::new(2192, 2992);
        for (x, y, px) in img.enumerate_pixels_mut() {
            *px = image::Rgb([(x % 251) as u8, (y % 241) as u8, ((x ^ y) % 233) as u8]);
        }
        let dynamic = DynamicImage::ImageRgb8(img);

        let start = Instant::now();
        let mut png = Vec::new();
        dynamic.write_to(&mut std::io::Cursor::new(&mut png), ImgFormat::Png).unwrap();
        let png_time = start.elapsed();

        let mut jpeg_92 = Vec::new();
        let start = Instant::now();
        {
            let mut cursor = std::io::Cursor::new(&mut jpeg_92);
            let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 92);
            enc.encode_image(&dynamic.to_rgb8()).unwrap();
        }
        let jpeg92_time = start.elapsed();

        let mut jpeg_100 = Vec::new();
        let start = Instant::now();
        {
            let mut cursor = std::io::Cursor::new(&mut jpeg_100);
            let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 100);
            enc.encode_image(&dynamic.to_rgb8()).unwrap();
        }
        let jpeg100_time = start.elapsed();

        println!("PNG      {:>8.0?}  {:>7.1} MB", png_time, png.len() as f64 / 1048576.0);
        println!("JPEG 92  {:>8.0?}  {:>7.1} MB", jpeg92_time, jpeg_92.len() as f64 / 1048576.0);
        println!("JPEG 100 {:>8.0?}  {:>7.1} MB", jpeg100_time, jpeg_100.len() as f64 / 1048576.0);
    }

    /// A single unreadable file must cost that card, not the whole document.
    #[tokio::test]
    async fn skips_unreadable_images_but_still_writes_the_pdf() {
        let dir = std::env::temp_dir().join("proxkit_pdf_partial");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let good = dir.join("good.png");
        image::RgbImage::new(20, 20).save(&good).unwrap();
        let bad = dir.join("bad.png");
        std::fs::write(&bad, b"this is not an image").unwrap();

        let request = request_for(
            &dir,
            vec![
                card_at(&good.to_string_lossy()),
                card_at(&bad.to_string_lossy()),
            ],
        );
        let outcome = generate_pdf(request, |_, _| {})
            .await
            .expect("should still produce a PDF");

        assert_eq!(outcome.skipped.len(), 1);
        assert!(outcome.skipped[0].file_path.ends_with("bad.png"));
        assert!(std::path::Path::new(&outcome.output_path).is_file());

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// If nothing at all could be read, that is a failure rather than an empty PDF.
    #[tokio::test]
    async fn fails_when_no_image_can_be_read() {
        let dir = std::env::temp_dir().join("proxkit_pdf_all_bad");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let bad = dir.join("bad.png");
        std::fs::write(&bad, b"nope").unwrap();

        let request = request_for(&dir, vec![card_at(&bad.to_string_lossy())]);
        let result = generate_pdf(request, |_, _| {}).await;

        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// With a zero offset and the source size, sampling must be an exact copy.
    #[test]
    fn resample_clamped_is_identity_at_zero_offset() {
        let mut src = RgbaImage::new(3, 2);
        for (i, px) in src.pixels_mut().enumerate() {
            *px = Rgba([i as u8, 0, 0, 255]);
        }
        let original = src.clone();

        let out = resample_clamped(&DynamicImage::ImageRgba8(src), 3, 2, 0, 0).to_rgba8();

        assert_eq!(out, original);
    }
}
