import { useEffect } from "react";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { applyTheme } from "./initTheme";
import { themeById } from "./themes";

/**
 * Keeps the page painted in the chosen theme.
 *
 * main.tsx applies the default palette before React mounts so the first paint is
 * never unstyled; the stored choice arrives later, because the desktop settings
 * store is async. Re-applying here covers both that and any later change.
 */
export function useColorTheme() {
    const colorTheme = useAppSettingsStore((state) => state.colorTheme);

    useEffect(() => {
        applyTheme(themeById(colorTheme).colors);
    }, [colorTheme]);
}
