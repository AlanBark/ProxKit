import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { THEMES, isGradient, swatchBackground, type Theme } from "../../theme/themes";
import { textStyles } from "../../theme/classNames";

interface ThemeSwatchesProps {
    themes: readonly Theme[];
    active: string;
    onPick: (id: string) => void;
}

function ThemeSwatches({ themes, active, onPick }: ThemeSwatchesProps) {
    return (
        <div className="flex flex-wrap items-start gap-3">
            {themes.map((theme) => {
                const isActive = theme.id === active;
                return (
                    // The swatch is painted with the theme's real page background,
                    // so a gradient looks like a gradient rather than being
                    // described as one. The name stays in the tooltip and the
                    // accessible label, where it costs no visual space.
                    <button
                        key={theme.id}
                        onClick={() => onPick(theme.id)}
                        aria-label={theme.label}
                        aria-pressed={isActive}
                        title={theme.label}
                        className={`w-10 h-10 rounded-full border-2 cursor-pointer transition ${
                            isActive ? "opacity-100" : "opacity-60 hover:opacity-100"
                        }`}
                        style={{
                            background: swatchBackground(theme),
                            borderColor: isActive ? theme.accent : "transparent",
                        }}
                    />
                );
            })}
        </div>
    );
}

/**
 * Picks the colour theme.
 *
 * Swatches rather than a dropdown: the choice is entirely visual, so showing
 * the colours is more useful than naming them. They are split by background
 * style because that is the difference people actually care about - a moving
 * backdrop or a still one.
 */
export function ThemeSetting() {
    const colorTheme = useAppSettingsStore((state) => state.colorTheme);
    const setColorTheme = useAppSettingsStore((state) => state.setColorTheme);

    const gradients = THEMES.filter(isGradient);
    const flats = THEMES.filter((theme) => !isGradient(theme));

    return (
        <div className="flex flex-col gap-3">
            <span className={`text-sm ${textStyles.primary}`}>Colour Theme</span>

            <div className="flex flex-col gap-1">
                <span className="text-xs opacity-60">Gradient</span>
                <ThemeSwatches themes={gradients} active={colorTheme} onPick={setColorTheme} />
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-xs opacity-60">Solid</span>
                <ThemeSwatches themes={flats} active={colorTheme} onPick={setColorTheme} />
            </div>
        </div>
    );
}
