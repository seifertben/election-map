import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from 'node:path';
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: ['index.html', 'es/index.html', 'fr/index.html', 'pt-br/index.html'].map(path => resolve(import.meta.dirname ?? '.', path)),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
    },
});
