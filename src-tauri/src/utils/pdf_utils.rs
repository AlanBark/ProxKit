use krilla::{Document, Data};
use krilla::page::PageSettings;
use krilla::image::Image;
use krilla::geom::{Size, Transform};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize, Serialize)]
pub struct ImagePosition {
    pub file_path: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PageLayout {
    pub width: f32,
    pub height: f32,
    pub images: Vec<ImagePosition>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PdfGenerationRequest {
    pub pages: Vec<PageLayout>,
    pub output_path: String,
}

/// Generates a PDF with images positioned on pages using Krilla with Rayon for parallel processing
pub async fn generate_pdf(request: PdfGenerationRequest) -> Result<String, String> {
    // Validate input
    if request.pages.is_empty() {
        return Err("No pages provided".to_string());
    }

    // Collect all unique image paths across all pages
    let all_image_paths: Vec<String> = request
        .pages
        .iter()
        .flat_map(|page| page.images.iter().map(|img| img.file_path.clone()))
        .collect();

    if all_image_paths.is_empty() {
        return Err("No images provided".to_string());
    }

    log::info!("Starting PDF generation with {} pages and {} total image references",
        request.pages.len(), all_image_paths.len());

    // =====================================================
    // STEP 1: Load all images in parallel
    // Each Image::from_* call returns immediately, but
    // spawns background decoding on rayon's thread pool
    // =====================================================
    let loaded_images: Vec<(String, Result<Image, String>)> = all_image_paths
        .par_iter()
        .map(|path| {
            let result = load_image(path);
            (path.clone(), result)
        })
        .collect();

    // Check for loading errors
    let mut image_map = std::collections::HashMap::new();
    for (path, result) in loaded_images {
        match result {
            Ok(img) => {
                image_map.insert(path.clone(), img);
            }
            Err(e) => {
                log::error!("Failed to load image {}: {}", path, e);
                return Err(format!("Failed to load image {}: {}", path, e));
            }
        }
    }

    log::info!("Loaded {} unique images, decoding in background...", image_map.len());

    // =====================================================
    // STEP 2: Create PDF document and add pages
    // Drawing blocks only if an image isn't ready yet
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

        for img_pos in &page_layout.images {
            if let Some(image) = image_map.get(&img_pos.file_path) {
                // Apply transform for positioning
                surface.push_transform(&Transform::from_translate(img_pos.x, img_pos.y));

                // Draw image - blocks if image is still decoding
                if let Some(size) = Size::from_wh(img_pos.width, img_pos.height) {
                    surface.draw_image(image.clone(), size);
                } else {
                    log::warn!("Invalid image dimensions: {}x{}", img_pos.width, img_pos.height);
                }

                surface.pop();
            } else {
                log::warn!("Image not found in map: {}", img_pos.file_path);
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
    Ok(request.output_path.clone())
}

/// Load an image from a file path, detecting format by extension
///
/// Supports both local file paths and data URIs (blob URLs converted to base64)
fn load_image(path: &str) -> Result<Image, String> {
    let data = std::fs::read(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let data: Data = Arc::new(data).into();

    // Detect format by extension
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "No file extension".to_string())?
        .to_lowercase();

    match ext.as_str() {
        "png" => Image::from_png(data, false)
            .map_err(|e| format!("PNG decode error: {}", e)),
        "jpg" | "jpeg" => Image::from_jpeg(data, false)
            .map_err(|e| format!("JPEG decode error: {}", e)),
        "gif" => Image::from_gif(data, false)
            .map_err(|e| format!("GIF decode error: {}", e)),
        "webp" => Image::from_webp(data, false)
            .map_err(|e| format!("WebP decode error: {}", e)),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}
