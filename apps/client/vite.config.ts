import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler"]],
			},
		}),
		tailwindcss(),
		tsconfigPaths(),
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
			workbox: {
				maximumFileSizeToCacheInBytes: 4_194_304,
				navigateFallbackDenylist: [/^\/api/],
			},
		}),
	],
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
