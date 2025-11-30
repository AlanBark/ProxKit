/**
 * Tauri-specific image upload implementation
 *
 * Uses native file dialogs and file system access
 */

import type { ImageUploadAdapter } from "../types";

export class TauriImageUploadAdapter implements ImageUploadAdapter {
  async selectImages(multiple: boolean = true): Promise<File[]> {
    // TODO: Implement using Tauri's dialog API
    // Example:
    // const { open } = await import('@tauri-apps/plugin-dialog');
    // const selected = await open({
    //   multiple,
    //   filters: [{
    //     name: 'Images',
    //     extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
    //   }]
    // });
    //
    // Then read files using Tauri's fs plugin
    // const { readBinaryFile } = await import('@tauri-apps/plugin-fs');
    // const fileData = await readBinaryFile(filePath);
    // return new File([fileData], fileName, { type: 'image/...' });

    throw new Error("Tauri image upload not yet implemented");
  }
}
