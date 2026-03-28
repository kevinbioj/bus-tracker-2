import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			manifest: {
				name: "Bus Tracker",
				short_name: "Bus Tracker",
				description: "Localisez vos trains, bus, tramways, métros et bateaux dans toute la France grâce à Bus Tracker",
				background_color: "#8A0045",
				theme_color: "#8A0045",
				display: "fullscreen",
				start_url: "/",
				icons: [
					{
						src: "/web-app-manifest-192x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any maskable",
					},
					{
						src: "/web-app-manifest-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
			registerType: "autoUpdate",
			includeAssets: ["logo.svg", "favicon.svg", "favicon.ico", "apple-touch-icon.png", "map-styles/*.json"],
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2,woff}"],
				cleanupOutdatedCaches: true,
				maximumFileSizeToCacheInBytes: 5_000_000,
				navigateFallbackDenylist: [/^\/api/],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "map-tiles-cache",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 60 * 60 * 24 * 30,
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /^https:\/\/.*\.posthog\.com\/.*/i,
						handler: "NetworkFirst",
						options: {
							cacheName: "posthog-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24,
							},
						},
					},
				],
			},
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				changeOrigin: true,
				target: "http://localhost:8080",
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
});
