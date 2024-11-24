import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tsconfigPaths(),
		VitePWA({
			manifest: {
				name: "Bus Tracker",
				short_name: "Bus Tracker",
				description: "Bus Tracker est une application de suivi des véhicules de transport en commun.",
				background_color: "#8A0045",
				theme_color: "#8A0045",
				display: "fullscreen",
				start_url: "/",
				icons: [
					{
						src: "images/touch/homescreen48.png",
						sizes: "48x48",
						type: "image/png",
					},
					{
						src: "images/touch/homescreen72.png",
						sizes: "72x72",
						type: "image/png",
					},
					{
						src: "images/touch/homescreen96.png",
						sizes: "96x96",
						type: "image/png",
					},
					{
						src: "images/touch/homescreen144.png",
						sizes: "144x144",
						type: "image/png",
					},
					{
						src: "images/touch/homescreen168.png",
						sizes: "168x168",
						type: "image/png",
					},
					{
						src: "images/touch/homescreen192.png",
						sizes: "192x192",
						type: "image/png",
					},
				],
			},
			registerType: "autoUpdate",
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
