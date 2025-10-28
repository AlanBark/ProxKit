// hero.ts
import { heroui } from "@heroui/react";
import { colors } from "./theme/colors";

export default heroui({
    themes: {
        dark: {
            colors: {
                // Using your existing theme colors as the single source of truth
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
                content1: colors.bgSurface,
                content2: colors.bgElevated,
                content3: colors.bgInput,
                content4: colors.bgHover,
                // Borders
                divider: colors.border,
                focus: colors.borderFocus,
                // Text
                default: {
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