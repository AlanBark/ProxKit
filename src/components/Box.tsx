import { type ReactNode } from "react";
import { backgroundStyles, textStyles } from "../theme/classNames";

interface BoxProps {
    children: ReactNode;
    title?: string;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Standardized container component with consistent styling
 */
export function Box({ children, title, style, className = "" }: BoxProps) {
    return (
        <div className={`${backgroundStyles.surface} rounded-xl p-5 border border-(--border) backdrop-blur-xl shadow-md hover:shadow-xl/30 hover:bg-(--bg-elevated) transition ${className}`} style={style}>
            {title && (
                <h3 className={`${textStyles.primary} font-semibold mb-4 text-sm uppercase tracking-wider`}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}
