import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme.js";

const config: Config = {
	content: ["./src/**/*.tsx"],
	theme: {
		extend: {
			animation: {
				"route-number": "route-number 2.5s linear infinite",
				page: "page 5s linear infinite",
			},
			colors: {
				primary: {
					DEFAULT: "#8c0046",
					50: "#ffd9ec",
					100: "#ffbfdf",
					150: "#ffa6d2",
					200: "#ff8cc5",
					250: "#ff73b8",
					300: "#ff59ac",
					350: "#ff409f",
					400: "#ff2692",
					450: "#ff0d85",
					500: "#f20078",
					550: "#d9006c",
					600: "#bf005f",
					650: "#a60052",
					700: "#8c0046",
					750: "#730039",
					800: "#80003f",
					850: "#59002c",
					900: "#400020",
					950: "#260013",
				},
			},
			fontFamily: {
				sans: ['"Achemine"', ...defaultTheme.fontFamily.sans],
			},
			keyframes: {
				"route-number": {
					"0%": { transform: "translateX(100%)" },
					"100%": { transform: "translateX(-100%)" },
				},
				page: {
					"0%": { transform: "translateX(95%)" },
					"100%": { transform: "translateX(-95%)" },
				},
			},
		},
	},
	plugins: [],
};

export default config;
