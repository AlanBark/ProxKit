use krilla::page::PageSettings;
use krilla::Document;

use std::path::Path;

#[tauri::command]
pub async fn generate_pdf(
    file_path: String,
) -> Result<String, String> {

    // First, we create a new document. This represents a single PDF document.
    let mut document = Document::new();
    
    // We can now successively add new pages by calling `start_page`, or `start_page_with`

    let page = document.start_page_with(PageSettings::from_wh(300.0, 600.0).unwrap());
    page.finish();

    // Create the PDF
    let pdf = document.finish().unwrap();

    let path = Path::new(&file_path);

    // Write the PDF to a file.
    std::fs::write(path, &pdf).unwrap();

    eprintln!("Saved PDF to '{}'", path.display());

    Ok(path.display().to_string())
}