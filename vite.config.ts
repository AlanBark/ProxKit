import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss()
    ],
    worker: {
        format: 'es'
    },
    // Keep vite's output on screen; `tauri dev` interleaves with it and the
    // combined log is how you diagnose a dev-server problem.
    clearScreen: false,
    server: {
        port: 5173,
        // src-tauri/tauri.conf.json hardcodes devUrl to this port. Without
        // strictPort, a stale server holding 5173 silently pushes this one to
        // 5174 - and the desktop app keeps loading the stale one, which looks
        // exactly like a code bug. Fail loudly instead.
        strictPort: true,
        watch: {
            // `tauri dev` runs its own watcher over src-tauri. Vite has no
            // reason to walk it, and src-tauri/target alone is tens of
            // thousands of files.
            ignored: ['**/src-tauri/**'],
            // Shell redirects and editors truncate a file before rewriting it.
            // Without this, vite can transform the zero-byte intermediate and
            // cache an empty module, which then fails to link with a confusing
            // "does not provide an export named X".
            awaitWriteFinish: {
                stabilityThreshold: 120,
                pollInterval: 20,
            },
        },
    },
})
