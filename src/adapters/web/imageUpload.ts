/**
 * Web-specific image upload implementation
 *
 * Uses standard HTML file input
 */

import type { ImageUploadAdapter } from "../types";

export class WebImageUploadAdapter implements ImageUploadAdapter {
  async selectImages(multiple: boolean = true): Promise<File[]> {
    return new Promise((resolve, reject) => {
      // Create hidden file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = multiple;
      input.style.display = "none";

      let isHandled = false;

      // Handle file selection
      const handleChange = () => {
        if (isHandled) return;
        isHandled = true;

        const files = input.files;
        if (files && files.length > 0) {
          resolve(Array.from(files));
        } else {
          resolve([]);
        }
        cleanup();
      };

      // Handle cancellation - use a timeout to avoid race condition
      const handleCancel = () => {
        setTimeout(() => {
          if (!isHandled) {
            isHandled = true;
            resolve([]);
            cleanup();
          }
        }, 100);
      };

      const cleanup = () => {
        input.removeEventListener("change", handleChange);
        window.removeEventListener("focus", handleCancel);
        if (input.parentNode) {
          document.body.removeChild(input);
        }
      };

      // Detect when user cancels (window regains focus without file selection)
      window.addEventListener("focus", handleCancel, { once: true });

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    });
  }
}
