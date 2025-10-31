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
        <div className={`${backgroundStyles.elevated} rounded-xl p-5 border border-(--border) ${className}`} style={style}>
            {title && (
                <h3 className={`${textStyles.primary} font-semibold mb-4 text-sm uppercase tracking-wider`}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}
