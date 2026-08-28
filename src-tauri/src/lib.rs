mod commands;
mod utils;

use commands::{generate_cardlist, library_fetch, library_find, save_text_file, thumbnail_find, thumbnail_save};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      generate_cardlist,
      library_find,
      library_fetch,
      thumbnail_find,
      thumbnail_save,
      save_text_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
