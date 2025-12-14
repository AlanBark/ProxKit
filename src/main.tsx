import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.tsx'
import { initTheme } from './theme/initTheme'
import { HeroUIProvider } from "@heroui/react";
import { BrowserRouter } from "react-router";

// Initialize theme colors
initTheme()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <HeroUIProvider>
                <App />
            </HeroUIProvider>
        </BrowserRouter>
    </StrictMode>,
)
