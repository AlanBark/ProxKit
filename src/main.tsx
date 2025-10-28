import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.tsx'
import { initTheme } from './theme/initTheme'

import {HeroUIProvider} from "@heroui/react";

// Initialize theme colors
initTheme()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <HeroUIProvider>
            <main className="dark text-foreground bg-background">
                <App />
            </main>
        </HeroUIProvider>
    </StrictMode>,
)
