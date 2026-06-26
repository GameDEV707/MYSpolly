//! Tauri desktop shell for MYSpolly.
//!
//! The shell loads the same web bundle used by the offline browser build and
//! adds a native window plus the filesystem and dialog plugins (used for native
//! Save/Load export-import). All game logic lives in the shared TypeScript
//! engine; this Rust layer is intentionally thin.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running the MYSpolly application");
}
