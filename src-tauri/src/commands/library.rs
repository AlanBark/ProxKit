use base64::Engine;
use std::path::{Path, PathBuf};

/// Google Apps Script proxy that serves Drive-hosted card art as base64 text.
/// Mirrors the endpoint the web build fetches directly.
const DRIVE_PROXY: &str = "https://script.google.com/macros/s/AKfycbwacdgZiqxpmcbE4tT6d5TL36zmd-nGBfSWIrbJyCsilH0TSG835Q0X9xcxSdKcxzLw/exec";

/// Thumbnails live beside the artwork, in their own subfolder.
const THUMBNAIL_DIR: &str = "thumbnails";

/// Characters that are not legal in a Windows filename. Card names contain
/// plenty of them - "Who/What/When/Where/Why" being the obvious offender.
const ILLEGAL: [char; 9] = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

const IMAGE_EXTENSIONS: [&str; 6] = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if ILLEGAL.contains(&c) || c.is_control() { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').to_string();
    if trimmed.is_empty() {
        "card".to_string()
    } else {
        trimmed
    }
}

/// MPCFill card names usually carry an extension already ("Black Lotus.png").
/// Drop it so it is not doubled up when we append the detected one.
fn strip_image_extension(name: &str) -> &str {
    let lower = name.to_ascii_lowercase();
    for ext in IMAGE_EXTENSIONS {
        if lower.ends_with(ext) {
            return &name[..name.len() - ext.len()];
        }
    }
    name
}

/// Extension implied by the file's magic bytes.
///
/// Deliberately not taken from the source name: Drive metadata regularly
/// disagrees with the actual contents, which is what made a mislabelled JPEG
/// break PDF generation in the first place.
fn extension_for(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        "png"
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "webp"
    } else if bytes.starts_with(b"GIF8") {
        "gif"
    } else {
        "jpg"
    }
}

/// Finds a library file for this Drive id.
///
/// Matches on the "(id)" token anywhere in the name and ignores the extension,
/// so a folder of MPC Autofill downloads works untouched.
fn find_by_drive_id(folder: &Path, drive_id: &str) -> Option<PathBuf> {
    let needle = format!("({})", drive_id);
    let entries = std::fs::read_dir(folder).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let matches = path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.contains(&needle));
        if matches {
            return Some(path);
        }
    }
    None
}

fn decode_base64_image(text: &str) -> Result<Vec<u8>, String> {
    // The proxy may return a data URI; keep only the payload.
    let payload = text.rsplit(',').next().unwrap_or(text);
    let cleaned: String = payload
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=')
        .collect();

    base64::engine::general_purpose::STANDARD
        .decode(cleaned.as_bytes())
        .map_err(|e| format!("Data was not valid base64: {}", e))
}

async fn download_from_drive(drive_id: &str, origin: &str) -> Result<Vec<u8>, String> {
    let url = format!("{}?id={}&origin={}", DRIVE_PROXY, drive_id, origin);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to reach the image proxy: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Image proxy returned HTTP {}", response.status()));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read the proxy response: {}", e))?;

    let bytes = decode_base64_image(&text)?;
    if bytes.is_empty() {
        return Err(format!("Image proxy returned nothing for {}", drive_id));
    }
    Ok(bytes)
}

/// Path to an image already in the library, if there is one.
#[tauri::command]
pub fn library_find(folder: String, drive_id: String) -> Option<String> {
    find_by_drive_id(Path::new(&folder), &drive_id).map(|p| p.to_string_lossy().into_owned())
}

/// Returns the library path for a Drive image, downloading it only if missing.
///
/// Named to match MPC Autofill's own convention, so its download folders can be
/// used as a library directly.
#[tauri::command]
pub async fn library_fetch(
    folder: String,
    drive_id: String,
    name: String,
    origin: String,
) -> Result<String, String> {
    let dir = Path::new(&folder);

    if let Some(existing) = find_by_drive_id(dir, &drive_id) {
        log::info!("Library hit for {} -> {}", drive_id, existing.display());
        return Ok(existing.to_string_lossy().into_owned());
    }

    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Could not create library folder {}: {}", folder, e))?;

    log::info!("Library miss for {}, downloading", drive_id);
    let bytes = download_from_drive(&drive_id, &origin).await?;

    let stem = sanitize_filename(strip_image_extension(&name));
    let target = dir.join(format!("{} ({}).{}", stem, drive_id, extension_for(&bytes)));

    std::fs::write(&target, &bytes)
        .map_err(|e| format!("Could not write {}: {}", target.display(), e))?;

    Ok(target.to_string_lossy().into_owned())
}

fn thumbnail_path(folder: &str, key: &str) -> PathBuf {
    Path::new(folder)
        .join(THUMBNAIL_DIR)
        .join(format!("{}.jpg", sanitize_filename(key)))
}

/// Path to a cached thumbnail, if one has been generated for this key.
#[tauri::command]
pub fn thumbnail_find(folder: String, key: String) -> Option<String> {
    let path = thumbnail_path(&folder, &key);
    path.is_file()
        .then(|| path.to_string_lossy().into_owned())
}

/// Stores a thumbnail rendered by the frontend.
///
/// Sent as base64 rather than a byte array because the IPC layer encodes the
/// latter as JSON numbers, which is several times larger.
#[tauri::command]
pub fn thumbnail_save(folder: String, key: String, data: String) -> Result<String, String> {
    let path = thumbnail_path(&folder, &key);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!("Could not create thumbnail folder {}: {}", parent.display(), e)
        })?;
    }

    let bytes = decode_base64_image(&data)?;
    std::fs::write(&path, &bytes)
        .map_err(|e| format!("Could not write {}: {}", path.display(), e))?;

    Ok(path.to_string_lossy().into_owned())
}

/// Writes text to a path the user chose in a save dialog.
///
/// Used for the DXF cut file, which is generated in the frontend and is small
/// enough that routing it through IPC costs nothing. The path always comes from
/// the native save dialog rather than from application code.
#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("Could not write {}: {}", path, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_an_existing_extension_before_composing() {
        assert_eq!(strip_image_extension("Black Lotus.png"), "Black Lotus");
        assert_eq!(strip_image_extension("Black Lotus"), "Black Lotus");
    }

    #[test]
    fn replaces_characters_that_are_illegal_in_filenames() {
        assert_eq!(sanitize_filename("Who/What/When"), "Who_What_When");
        assert!(!sanitize_filename("a:b*c?d").contains(':'));
        assert_eq!(sanitize_filename("   "), "card");
    }

    #[test]
    fn detects_format_from_content_not_name() {
        assert_eq!(extension_for(&[0xFF, 0xD8, 0xFF, 0xE0]), "jpg");
        assert_eq!(extension_for(&[0x89, b'P', b'N', b'G']), "png");
    }

    #[test]
    fn finds_a_file_by_its_drive_id_regardless_of_extension() {
        let dir = std::env::temp_dir().join("proxkit_library_test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("Black Lotus (ABC123).png");
        std::fs::write(&file, b"x").unwrap();

        assert_eq!(find_by_drive_id(&dir, "ABC123"), Some(file));
        assert_eq!(find_by_drive_id(&dir, "NOPE"), None);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
