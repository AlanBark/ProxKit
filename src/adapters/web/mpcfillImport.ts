/**
 * Web-specific MPCFill XML import implementation
 *
 * Uses standard HTML file input and browser APIs
 */

import type { MPCFillImportAdapter } from "../types";
import type { MPCFillParseResult } from "../../utils/mpcfill/types";
import { parseMPCFillXML } from "../../utils/mpcfill/xmlParser";
import { downloadMultipleImages } from "../../utils/mpcfill/driveDownloader";

export class WebMPCFillImportAdapter implements MPCFillImportAdapter {
  async selectAndParseXML(): Promise<{
    parseResult: MPCFillParseResult;
    xmlContent: string;
  }> {
    return new Promise((resolve, reject) => {
      // Create hidden file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xml";
      input.style.display = "none";

      // Handle file selection
      const handleChange = async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            const xmlContent = await file.text();
            const parseResult = parseMPCFillXML(xmlContent);
            resolve({ parseResult, xmlContent });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error("No file selected"));
        }
        cleanup();
      };

      // Handle cancellation
      const handleCancel = () => {
        reject(new Error("File selection cancelled"));
        cleanup();
      };

      const cleanup = () => {
        input.removeEventListener("change", handleChange);
        window.removeEventListener("focus", handleCancel);
        document.body.removeChild(input);
      };

      // Detect when user cancels (window regains focus without file selection)
      window.addEventListener("focus", handleCancel, { once: true });

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    });
  }

  async downloadImages(
    driveIds: string[],
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<File[]> {
    const fileInfos = driveIds.map((id, index) => ({
      id,
      name: `card_${index + 1}.jpg`,
    }));

    let completed = 0;
    const total = driveIds.length;

    const results = await downloadMultipleImages(
      fileInfos,
      (file, id, index) => {
        completed++;
        const percentage = Math.round((completed / total) * 100);

        if (onProgress) {
          onProgress(completed, total, percentage);
        }
      }
    );

    return results.map((r) => r.file);
  }
}
