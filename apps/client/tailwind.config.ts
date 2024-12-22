import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme.js";

const config: Config = {
	content: ["./src/**/*.tsx"],
	theme: {
		extend: {
			animation: {
				"route-number": "route-number 3s linear infinite",
				page: "page 6s linear infinite",
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
			colors: {
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				branding: {
					DEFAULT: "hsl(var(--branding))",
					foreground: "hsl(var(--branding-foreground))",
				},
				"branding-accent": {
					DEFAULT: "hsl(var(--branding-accent))",
					foreground: "hsl(var(--branding-accent-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					"1": "hsl(var(--chart-1))",
					"2": "hsl(var(--chart-2))",
					"3": "hsl(var(--chart-3))",
					"4": "hsl(var(--chart-4))",
					"5": "hsl(var(--chart-5))",
				},
			},
			fontFamily: {
				sans: ['"Achemine"', ...defaultTheme.fontFamily.sans],
			},
			keyframes: {
				"route-number": {
					"0%": {
						transform: "translateX(100%)",
					},
					"100%": {
						transform: "translateX(-100%)",
					},
				},
				page: {
					"0%": {
						transform: "translateX(100%)",
					},
					"100%": {
						transform: "translateX(-100%)",
					},
				},
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};

export default config;
