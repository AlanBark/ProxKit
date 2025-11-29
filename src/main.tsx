import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.tsx'
import { initTheme } from './theme/initTheme'

import {HeroUIProvider} from "@heroui/react";
import { MPCFillProvider } from './context/MPCFillContext';

// Initialize theme colors
initTheme()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <HeroUIProvider>
            <MPCFillProvider>
                <App />
            </MPCFillProvider>
        </HeroUIProvider>
    </StrictMode>,
)
