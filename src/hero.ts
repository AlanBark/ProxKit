// hero.ts
import { heroui } from "@heroui/react";
import { colors } from "./theme/colors";

export default heroui({
    themes: {
        dark: {
            colors: {
                primary: {
                    DEFAULT: colors.primary,
                    foreground: "#ffffff",
                },
                danger: {
                    DEFAULT: colors.danger,
                    foreground: "#ffffff",
                },
                success: {
                    DEFAULT: colors.success,
                    foreground: "#ffffff",
                },
                warning: {
                    DEFAULT: colors.warning,
                    foreground: "#000000",
                },
                // Background colors
                background: colors.bgApp,
                foreground: colors.textPrimary,
                content1: colors.bgDropdown,  // Solid background for dropdowns
                content2: colors.bgSurface,
                content3: colors.bgElevated,
                content4: colors.bgInput,
                // Borders
                divider: colors.border,
                focus: colors.borderFocus,
                // Default variant colors (used by Input with variant="flat")
                default: {
                    50: colors.bgElevated,
                    100: colors.bgInput,
                    200: colors.bgInput,
                    300: colors.border,
                    400: colors.textMuted,
                    500: colors.textSecondary,
                    600: colors.textPrimary,
                    700: colors.textPrimary,
                    800: colors.textPrimary,
                    900: colors.textPrimary,
                    DEFAULT: colors.bgInput,
                    foreground: colors.textPrimary,
                },
            },
        },
    },
    layout: {
        fontSize: {
            tiny: "0.75rem",     // 12px
            small: "0.875rem",   // 14px
            medium: "1rem",      // 16px
            large: "1.125rem",   // 18px
        },
        lineHeight: {
            tiny: "1rem",
            small: "1.25rem",
            medium: "1.5rem",
            large: "1.75rem",
        },
        radius: {
            small: "0.5rem",     // 8px
            medium: "0.75rem",   // 12px
            large: "1rem",       // 16px
        },
        borderWidth: {
            small: "1px",
            medium: "1px",
            large: "2px",
        },
    },
});