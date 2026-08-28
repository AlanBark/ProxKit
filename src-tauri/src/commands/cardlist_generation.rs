use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::utils::pdf_utils::{self, CardImagePosition, EmbeddedImage, ImageFormat, PageLayout, PdfGenerationOutcome, PdfGenerationRequest};

/// Event the frontend listens on for image-preparation progress.
const PROGRESS_EVENT: &str = "cardlist-progress";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationProgress {
    done: usize,
    total: usize,
}

/// Grid layout constants matching pdfWorker.ts
const GRID_COLS: usize = 4;
const GRID_ROWS: usize = 2;
const CARDS_PER_PAGE: usize = GRID_COLS * GRID_ROWS; // 8 cards per page

/// Embedded registration mark images
const REGISTRATION_A4: &[u8] = include_bytes!("../assets/a4_registration.jpg");
const REGISTRATION_LETTER: &[u8] = include_bytes!("../assets/letter_registration.jpg");

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CardImageData {
    pub id: String,
    /// Absolute path to the front image on disk.
    pub image_path: String,
    pub name: Option<String>,
    pub bleed: f32,
    pub use_custom_bleed: bool,
    /// Absolute path to this card's own back image, if it has one.
    pub card_back_path: Option<String>,
    pub card_back_bleed: f32,
    pub use_custom_card_back_bleed: bool,
}

/// Request from frontend for cardlist generation
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardListGenerationRequest {
    pub cards: Vec<Option<CardImageData>>,
    pub output_path: String,
    pub page_width: f32,
    pub page_height: f32,
    pub card_width: f32,
    pub card_height: f32,
    pub output_bleed: f32,
    pub enable_card_backs: bool,
    pub default_card_back_path: Option<String>,
}

/// Grid layout configuration for card placement
struct GridLayout {
    x: f32,           // Starting X position (left edge) in points
    y: f32,           // Starting Y position (top edge) in points
    cell_width: f32,  // Width of each cell in points
    cell_height: f32, // Height of each cell in points
}

/// Calculate grid layout for 4x2 card arrangement, centered on the page
fn calculate_grid_layout(
    page_width: f32,
    page_height: f32,
    card_width: f32,
    card_height: f32,
) -> GridLayout {
    // Calculate total grid dimensions (no gaps between cards)
    let total_grid_width = card_width * GRID_COLS as f32;
    let total_grid_height = card_height * GRID_ROWS as f32;

    // Center the grid on the page
    let start_x = (page_width - total_grid_width) / 2.0;
    let start_y = (page_height - total_grid_height) / 2.0;

    GridLayout {
        x: start_x,
        y: start_y,
        cell_width: card_width,
        cell_height: card_height,
    }
}

/// Calculate the grid position for a card based on its slot index
fn calculate_card_position(slot_index: usize) -> (usize, usize) {
    let col = slot_index % GRID_COLS;
    let row = slot_index / GRID_COLS;
    (col, row)
}

/// Calculate mirrored column position for card backs (for double-sided printing)
fn calculate_mirrored_column(original_col: usize) -> usize {
    (GRID_COLS - 1) - original_col
}

/// Tauri command to generate PDF from a cardlist
/// This command accepts an ordered array of CardImages from the frontend,
/// processes them, and calls pdf_utils to generate the final PDF
///
/// Uses a fixed 4x2 grid layout matching pdfWorker.ts
#[tauri::command]
pub async fn generate_cardlist(
    app: tauri::AppHandle,
    request: CardListGenerationRequest,
) -> Result<PdfGenerationOutcome, String> {
    log::info!("generate_cardlist called with {} card slots", request.cards.len());

    // Validate input - check if there are any actual cards (not just gaps)
    let actual_card_count = request.cards.iter().filter(|c| c.is_some()).count();
    if actual_card_count == 0 {
        return Err("No cards provided".to_string());
    }

    log::info!(
        "Generating cardlist PDF with {} cards ({} slots), card backs: {}",
        actual_card_count,
        request.cards.len(),
        request.enable_card_backs
    );

    // Convert millimeters to points (PDF uses points: 1mm = 2.83465 points)
    const MM_TO_POINTS: f32 = 2.83465;

    // Page dimensions in points (landscape orientation - swap width/height)
    let page_width_pts = request.page_height * MM_TO_POINTS; // Landscape width
    let page_height_pts = request.page_width * MM_TO_POINTS; // Landscape height

    // Card cell dimensions including output bleed
    let cell_width_pts = (request.card_width + (2.0 * request.output_bleed)) * MM_TO_POINTS;
    let cell_height_pts = (request.card_height + (2.0 * request.output_bleed)) * MM_TO_POINTS;

    // Calculate centered grid layout
    let grid_layout = calculate_grid_layout(
        page_width_pts,
        page_height_pts,
        cell_width_pts,
        cell_height_pts,
    );

    log::info!(
        "Page layout: {}x{} grid ({} cards per page), grid starts at ({:.2}, {:.2})",
        GRID_COLS,
        GRID_ROWS,
        CARDS_PER_PAGE,
        grid_layout.x,
        grid_layout.y
    );

    // Calculate total pages needed
    let total_pages = (request.cards.len() + CARDS_PER_PAGE - 1) / CARDS_PER_PAGE;

    log::info!(
        "Total pages to generate: {}, cards.len()={}, CARDS_PER_PAGE={}",
        total_pages,
        request.cards.len(),
        CARDS_PER_PAGE
    );

    // Select registration background based on page size (A4 vs Letter)
    // A4 is 210mm wide, Letter is 215.9mm wide
    let registration_bg = if request.page_width == 210.0 {
        REGISTRATION_A4
    } else {
        REGISTRATION_LETTER
    };

    // Create the embedded background image for registration marks
    let background = Some(EmbeddedImage {
        data: registration_bg,
        format: ImageFormat::Jpeg,
        x: 0.0,
        y: 0.0,
        width: page_width_pts,
        height: page_height_pts,
    });

    // Build pages with positioned images
    let mut pages: Vec<PageLayout> = Vec::new();

    for page_num in 0..total_pages {
        let start_idx = page_num * CARDS_PER_PAGE;
        let end_idx = std::cmp::min(start_idx + CARDS_PER_PAGE, request.cards.len());
        let page_cards = &request.cards[start_idx..end_idx];

        log::info!(
            "Processing page {}/{}, cards in slice: {} (indices {}..{})",
            page_num + 1,
            total_pages,
            page_cards.len(),
            start_idx,
            end_idx
        );

        // Create front page
        let mut front_images: Vec<CardImagePosition> = Vec::new();

        for (slot_idx, card_opt) in page_cards.iter().enumerate() {
            // Skip None entries (gaps/skipped slots)
            let Some(card) = card_opt else {
                log::debug!("Slot {} is None, skipping", slot_idx);
                continue;
            };

            let (col, row) = calculate_card_position(slot_idx);

            // Calculate cell position (top-left of the cell)
            let cell_x = grid_layout.x + (col as f32 * grid_layout.cell_width);
            let cell_y = grid_layout.y + (row as f32 * grid_layout.cell_height);

            // Source bleed is from the card data (bleed in the original image).
            // `bleed` is always the effective value - `use_custom_bleed` only marks it as
            // user-overridden so it is not re-synced when defaultBleed changes. Matches pdfWorker.ts.
            let source_bleed = card.bleed;

            log::info!(
                "Placing {}, bleed {}, usecustombleed {}",
                card.name.as_deref().unwrap_or("unnamed"),
                source_bleed,
                card.use_custom_bleed
            );

            front_images.push(CardImagePosition {
                file_path: card.image_path.clone(),
                cell_x,
                cell_y,
                cell_width: cell_width_pts,
                cell_height: cell_height_pts,
                source_bleed_mm: source_bleed,
                output_bleed_mm: request.output_bleed,
                card_width_mm: request.card_width,
                card_height_mm: request.card_height,
            });
        }

        log::info!(
            "Page {} front: {} card images to render",
            page_num + 1,
            front_images.len()
        );

        pages.push(PageLayout {
            width: page_width_pts,
            height: page_height_pts,
            card_images: front_images,
            background: background.clone(),
        });

        // Create back page if card backs are enabled
        if request.enable_card_backs {
            let mut back_images: Vec<CardImagePosition> = Vec::new();

            for (slot_idx, card_opt) in page_cards.iter().enumerate() {
                // Skip None entries (gaps/skipped slots)
                let Some(card) = card_opt else {
                    continue;
                };

                // Determine which card back URL to use
                let card_back_path = card.card_back_path.as_ref()
                    .or(request.default_card_back_path.as_ref());

                // Skip if no card back available
                let Some(back_path) = card_back_path else {
                    continue;
                };

                // Calculate MIRRORED position for proper alignment when page is flipped
                let (original_col, row) = calculate_card_position(slot_idx);
                let mirrored_col = calculate_mirrored_column(original_col);

                // Calculate cell position with mirrored column
                let cell_x = grid_layout.x + (mirrored_col as f32 * grid_layout.cell_width);
                let cell_y = grid_layout.y + (row as f32 * grid_layout.cell_height);

                // Source bleed for card back - always the effective value, as with fronts
                let source_bleed = card.card_back_bleed;

                back_images.push(CardImagePosition {
                    file_path: back_path.clone(),
                    cell_x,
                    cell_y,
                    cell_width: cell_width_pts,
                    cell_height: cell_height_pts,
                    source_bleed_mm: source_bleed,
                    output_bleed_mm: request.output_bleed,
                    card_width_mm: request.card_width,
                    card_height_mm: request.card_height,
                });
            }

            // Only add back page if there are any backs to render
            if !back_images.is_empty() {
                pages.push(PageLayout {
                    width: page_width_pts,
                    height: page_height_pts,
                    card_images: back_images,
                    background: background.clone(),
                });
            }
        }
    }

    // Call pdf_utils to generate the PDF
    let pdf_request = PdfGenerationRequest {
        pages,
        output_path: request.output_path.clone(),
    };

    log::info!("Calling pdf_utils to generate {} pages", pdf_request.pages.len());

    // Preparing the images is the slow part, so report it as it happens rather
    // than leaving the window looking frozen.
    pdf_utils::generate_pdf(pdf_request, move |done, total| {
        let _ = app.emit(
            PROGRESS_EVENT,
            GenerationProgress { done, total },
        );
    })
    .await
}
