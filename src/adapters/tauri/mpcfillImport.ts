/**
 * Tauri-specific MPCFill XML import implementation
 *
 * Uses native file dialogs and file system access
 */

import type { MPCFillImportAdapter } from "../types";
import type { MPCFillParseResult } from "../../utils/mpcfill/types";
import { parseMPCFillXML } from "../../utils/mpcfill/xmlParser";

export class TauriMPCFillImportAdapter implements MPCFillImportAdapter {
  async selectAndParseXML(): Promise<{
    parseResult: MPCFillParseResult;
    xmlContent: string;
  }> {
    // TODO: Implement using Tauri's dialog and fs APIs
    // const { open } = await import('@tauri-apps/plugin-dialog');
    // const selected = await open({
    //   multiple: false,
    //   filters: [{
    //     name: 'XML',
    //     extensions: ['xml']
    //   }]
    // });
    //
    // const { readTextFile } = await import('@tauri-apps/plugin-fs');
    // const xmlContent = await readTextFile(selected);
    // const parseResult = parseMPCFillXML(xmlContent);
    //
    // return { parseResult, xmlContent };

    throw new Error("Tauri MPCFill import not yet implemented");
  }

  async downloadImages(
    driveIds: string[],
    onProgress?: (current: number, total: number, percentage: number) => void
  ): Promise<File[]> {
    // TODO: Implement using Tauri's HTTP client
    // Can use the same Google Drive download logic as web,
    // but with Tauri's fetch client for better performance
    //
    // const { fetch } = await import('@tauri-apps/plugin-http');
    // for (const id of driveIds) {
    //   const response = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
    //   const blob = await response.blob();
    //   // Convert to File and save locally if needed
    // }

    throw new Error("Tauri image download not yet implemented");
  }
}
