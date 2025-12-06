fn main() {
    // Skip Windows resource generation if icon doesn't exist
    if std::path::Path::new("icons/icon.ico").exists() {
        tauri_build::build()
    } else {
        // Minimal build without icon - for development only
        println!("cargo:warning=Icon not found, skipping Windows resource generation");
        tauri_build::build()
    }
}
