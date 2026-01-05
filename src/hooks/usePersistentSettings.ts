import { useState, useEffect, useCallback } from 'react';

/**
 * Persistent settings interface
 * These settings are stored using Tauri Store plugin (Tauri only)
 */
export interface PersistentSettings {
  theme: 'light' | 'dark';
  language: string;
  defaultBleed: number;
  defaultCardSize: {
    width: number;
    height: number;
  };
}

const DEFAULT_SETTINGS: PersistentSettings = {
  theme: 'light',
  language: 'en',
  defaultBleed: 0.125,
  defaultCardSize: {
    width: 2.5,
    height: 3.5,
  },
};

/**
 * React hook for persistent settings (Tauri only)
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const { settings, updateSetting, isLoading } = usePersistentSettings();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <p>Theme: {settings.theme}</p>
 *       <button onClick={() => updateSetting('theme', 'dark')}>
 *         Dark Mode
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersistentSettings() {
  const [settings, setSettings] = useState<PersistentSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // @ts-ignore - Tauri plugin only available in Tauri context
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = await Store.load('settings.json');

        // Load all settings
        const entries = await store.entries();
        const loaded: Partial<PersistentSettings> = {};

        for (const [key, value] of entries) {
          loaded[key as keyof PersistentSettings] = value as any;
        }

        // Merge with defaults
        setSettings({ ...DEFAULT_SETTINGS, ...loaded });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load settings'));
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Update a single setting
  const updateSetting = useCallback(
    async <K extends keyof PersistentSettings>(key: K, value: PersistentSettings[K]) => {
      try {
        // @ts-ignore - Tauri plugin only available in Tauri context
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = await Store.load('settings.json');

        await store.set(key as string, value);
        await store.save();

        setSettings((prev) => ({ ...prev, [key]: value }));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update setting'));
        console.error('Failed to update setting:', err);
        throw err;
      }
    },
    []
  );

  // Update multiple settings at once
  const updateSettings = useCallback(async (updates: Partial<PersistentSettings>) => {
    try {
      // @ts-ignore - Tauri plugin only available in Tauri context
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');

      for (const [key, value] of Object.entries(updates)) {
        await store.set(key, value);
      }
      await store.save();

      setSettings((prev) => ({ ...prev, ...updates }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, []);

  // Reset all settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      // @ts-ignore - Tauri plugin only available in Tauri context
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');

      await store.clear();

      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await store.set(key, value);
      }
      await store.save();

      setSettings(DEFAULT_SETTINGS);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reset settings'));
      console.error('Failed to reset settings:', err);
      throw err;
    }
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    updateSettings,
    resetSettings,
  };
}