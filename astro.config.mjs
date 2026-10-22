// @ts-check
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    integrations: [
        react(),
        tailwind({
            applyBaseStyles: false,
        }),
        AstroPWA({
            // Phones load a new deployment on the next visit instead of
            // keeping the old version until every tab is closed
            registerType: "autoUpdate",
            manifest: {
                // Under the icon on the home screen; "Hide & Seek Vienna"
                // would be cut off on most phones
                name: "Hide & Seek Vienna",
                short_name: "Hide & Seek",
                description:
                    "Map, questions and rules for our games of Jet Lag Hide and Seek in Vienna.",
                icons: [
                    {
                        src: "https://danumi.github.io/JetLagHideAndSeek/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "https://danumi.github.io/JetLagHideAndSeek/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        // The icon fills its square, so Android can crop it
                        src: "https://danumi.github.io/JetLagHideAndSeek/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "https://danumi.github.io/JetLagHideAndSeek/icon-1080.png",
                        sizes: "1080x1080",
                        type: "image/png",
                    },
                ],
                theme_color: "#1F2F3F",
                // Android's own start screen, before the app's loading screen
                background_color: "#1F2F3F",
            },
            workbox: {
                // The pictures of the quick guide and the loading screen's
                // icon, so the help works without a connection
                globPatterns: ["**/*.{js,css,html,svg,webp}"],
            },
        }),
    ],
    devToolbar: {
        enabled: false,
    },
    site: "https://danumi.github.io",
    base: "JetLagHideAndSeek",
});
