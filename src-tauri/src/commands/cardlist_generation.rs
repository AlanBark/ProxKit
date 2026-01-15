use serde::{Deserialize, Serialize};
use crate::utils::pdf_utils::{self, ImagePosition, PageLayout, PdfGenerationRequest};

/// Minimal card data needed for PDF generation (excluding thumbnails)
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CardImageData {
    pub id: String,
    pub image_url: String,
    pub name: Option<String>,
    pub bleed: f32,
    pub use_custom_bleed: bool,
    #[serde(rename = "cardBackUrl")]
    pub card_back_url: Option<String>,
    pub card_back_bleed: f32,
    pub use_custom_card_back_bleed: bool,
}

/// Request from frontend for cardlist generation
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardListGenerationRequest {
    pub cards: Vec<CardImageData>,
    pub output_path: String,
    // Page settings (in millimeters)
    pub page_width: f32,
    pub page_height: f32,
    pub page_margin: f32,
    // Card dimensions (in millimeters)
    pub card_width: f32,
    pub card_height: f32,
}

/// Tauri command to generate PDF from a cardlist
/// This command accepts an ordered array of CardImages from the frontend,
/// processes them, and calls pdf_utils to generate the final PDF
#[tauri::command]
pub async fn generate_cardlist(request: CardListGenerationRequest) -> Result<String, String> {
    // Validate input
    if request.cards.is_empty() {
        return Err("No cards provided".to_string());
    }

    log::info!(
        "Generating cardlist PDF with {} cards",
        request.cards.len()
    );

    // Convert millimeters to points (PDF uses points: 1mm = 2.83465 points)
    const MM_TO_POINTS: f32 = 2.83465;

    let page_width_pts = request.page_width * MM_TO_POINTS;
    let page_height_pts = request.page_height * MM_TO_POINTS;
    let margin_pts = request.page_margin * MM_TO_POINTS;
    let card_width_pts = request.card_width * MM_TO_POINTS;
    let card_height_pts = request.card_height * MM_TO_POINTS;

    // Calculate how many cards fit per page (3x3 grid is common)
    let available_width = page_width_pts - (2.0 * margin_pts);
    let available_height = page_height_pts - (2.0 * margin_pts);

    let cards_per_row = (available_width / card_width_pts).floor() as usize;
    let cards_per_col = (available_height / card_height_pts).floor() as usize;
    let cards_per_page = cards_per_row * cards_per_col;

    if cards_per_page == 0 {
        return Err("Card dimensions too large for page size".to_string());
    }

    log::info!(
        "Page layout: {}x{} cards per page ({} total per page)",
        cards_per_row,
        cards_per_col,
        cards_per_page
    );

    // Build pages with positioned images
    let mut pages: Vec<PageLayout> = Vec::new();
    let mut card_chunks = request.cards.chunks(cards_per_page);

    while let Some(page_cards) = card_chunks.next() {
        let mut images: Vec<ImagePosition> = Vec::new();

        for (idx, card) in page_cards.iter().enumerate() {
            let row = idx / cards_per_row;
            let col = idx % cards_per_row;

            let x = margin_pts + (col as f32 * card_width_pts);
            let y = margin_pts + (row as f32 * card_height_pts);

            // Add front image with bleed
            let front_width = card_width_pts + (card.bleed * MM_TO_POINTS * 2.0);
            let front_height = card_height_pts + (card.bleed * MM_TO_POINTS * 2.0);
            let front_x = x - (card.bleed * MM_TO_POINTS);
            let front_y = y - (card.bleed * MM_TO_POINTS);

            images.push(ImagePosition {
                file_path: card.image_url.clone(),
                x: front_x,
                y: front_y,
                width: front_width,
                height: front_height,
            });

            // Add back image if present
            if let Some(back_url) = &card.card_back_url {
                let back_width = card_width_pts + (card.card_back_bleed * MM_TO_POINTS * 2.0);
                let back_height = card_height_pts + (card.card_back_bleed * MM_TO_POINTS * 2.0);
                let back_x = x - (card.card_back_bleed * MM_TO_POINTS);
                let back_y = y - (card.card_back_bleed * MM_TO_POINTS);

                images.push(ImagePosition {
                    file_path: back_url.clone(),
                    x: back_x,
                    y: back_y,
                    width: back_width,
                    height: back_height,
                });
            }
        }

        pages.push(PageLayout {
            width: page_width_pts,
            height: page_height_pts,
            images,
        });
    }

    // Call pdf_utils to generate the PDF
    let pdf_request = PdfGenerationRequest {
        pages,
        output_path: request.output_path.clone(),
    };

    log::info!("Calling pdf_utils to generate {} pages", pdf_request.pages.len());

    pdf_utils::generate_pdf(pdf_request).await
}
