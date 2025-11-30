/**
 * Platform detection utility
 *
 * Detects whether the app is running in Tauri (desktop) or web browser
 */

/**
 * Check if running in Tauri environment
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Check if running in web browser
 */
export const isWeb = (): boolean => {
  return !isTauri();
};

/**
 * Platform feature flags
 */
export const platformFeatures = {
  get localFileSystem(): boolean {
    return isTauri();
  },
  get nativeDialogs(): boolean {
    return isTauri();
  },
  get webUpload(): boolean {
    return isWeb();
  },
  get nativePdfGeneration(): boolean {
    return isTauri();
  },
} as const;
