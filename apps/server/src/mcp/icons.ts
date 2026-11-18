import type { Icon } from "@modelcontextprotocol/server";

import { siteUrl } from "../options.js";

export type IconName = "network" | "line" | "stop" | "journey" | "vehicle" | "alert" | "info";

export const iconsOf = (name: IconName): Icon[] => [
	{ src: `${siteUrl}/mcp/icons/${name}.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
	{ src: `${siteUrl}/mcp/icons/${name}.png`, mimeType: "image/png", sizes: ["96x96"] },
];

export const serverIcons: Icon[] = [
	{ src: `${siteUrl}/favicon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
	{ src: `${siteUrl}/web-app-manifest-192x192.png`, mimeType: "image/png", sizes: ["192x192"] },
	{ src: `${siteUrl}/web-app-manifest-512x512.png`, mimeType: "image/png", sizes: ["512x512"] },
];

const mimeTypeOf = (href: string) => {
	const extension = new URL(href).pathname.split(".").at(-1)?.toLowerCase();
	if (extension === "svg") return "image/svg+xml";
	if (extension === "png") return "image/png";
	if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
	if (extension === "webp") return "image/webp";
	return undefined;
};

const logoIcon = (href: string, theme: "light" | "dark"): Icon => {
	const mimeType = mimeTypeOf(href);
	return { src: href, theme, ...(mimeType !== undefined ? { mimeType } : {}) };
};

export function networkLogoIcons(logoHref: string | null, darkModeLogoHref: string | null): Icon[] {
	if (logoHref === null) return iconsOf("network");
	return [logoIcon(logoHref, "light"), logoIcon(darkModeLogoHref ?? logoHref, "dark")];
}
