export const ALLOWED_FONT_FAMILIES = {
	"Hanover Graphic": ["0808B2E1", "1310C2E1", "1508C2E1", "1510N2E1", "1513B3E1", "17SYMBOLS"],
	"Hanover Super-X": ["0505SUPX", "1107SUPX", "1407SUPX", "1507SUPX", "1508SUPX", "1710SUPX"],
} as const;

export type AllowedFontFamily = keyof typeof ALLOWED_FONT_FAMILIES;
export type AllowedFont = (typeof ALLOWED_FONT_FAMILIES)[AllowedFontFamily][number];

export const FONT_HEIGHTS: Record<AllowedFont, number> = {
	"0808B2E1": 8,
	"1310C2E1": 13,
	"1508C2E1": 15,
	"1510N2E1": 15,
	"1513B3E1": 15,
	"0505SUPX": 5,
	"1107SUPX": 11,
	"1407SUPX": 14,
	"1507SUPX": 15,
	"1508SUPX": 15,
	"1710SUPX": 17,
	"17SYMBOLS": 17,
};

export const DEFAULT_FONT_FAMILY: AllowedFontFamily = "Hanover Graphic";
export const DEFAULT_FONT_VARIANT: AllowedFont = "1513B3E1";

export const ALL_FONTS: readonly AllowedFont[] = [
	...ALLOWED_FONT_FAMILIES["Hanover Graphic"],
	...ALLOWED_FONT_FAMILIES["Hanover Super-X"],
] as const;

export const FONT_FAMILY_SHORT: Record<AllowedFontFamily, string> = {
	"Hanover Graphic": "Graphique",
	"Hanover Super-X": "Super-X",
};

export function getFontFamily(fontVariant: string): AllowedFontFamily {
	for (const [family, fonts] of Object.entries(ALLOWED_FONT_FAMILIES) as [AllowedFontFamily, readonly string[]][]) {
		if (fonts.includes(fontVariant)) return family;
	}
	return DEFAULT_FONT_FAMILY;
}

export function getFontLabel(font: AllowedFont): string {
	const family = getFontFamily(font);
	return `${FONT_FAMILY_SHORT[family]} ${font} (${FONT_HEIGHTS[font]}px)`;
}

export function getFirstValidVariant(family: AllowedFontFamily, maxHeight?: number): AllowedFont {
	const variants = ALLOWED_FONT_FAMILIES[family] as readonly AllowedFont[];
	if (maxHeight === undefined) return variants[0];
	return variants.find((v) => FONT_HEIGHTS[v] <= maxHeight) ?? variants[0];
}

/** Fonts allowed on either line when a page holds two lines. */
export const DUAL_LINE_FONTS: readonly AllowedFont[] = ["0808B2E1", "0505SUPX", "1107SUPX"] as const;

const DUAL_LINE_FONTS_BY_FAMILY = (family: AllowedFontFamily) =>
	DUAL_LINE_FONTS.filter((v) => getFontFamily(v) === family);

/**
 * Returns the font line 1 must fall back to when a second line is added,
 * keeping the current family whenever possible.
 */
export function getLine1FontForDualLine(line1Font: AllowedFont): AllowedFont {
	if (DUAL_LINE_FONTS.includes(line1Font)) return line1Font;
	return getFontFamily(line1Font) === "Hanover Super-X" ? "1107SUPX" : "0808B2E1";
}

/**
 * Returns the fonts available for line 2 given line 1's font.
 * - Graphic line 1 → Graphic dual-line fonts
 * - Super-X line 1 → Super-X dual-line fonts + Graphic ones
 */
export function getFontsForDualLine(line1Font: AllowedFont): readonly AllowedFont[] {
	const graphic = DUAL_LINE_FONTS_BY_FAMILY("Hanover Graphic");
	if (getFontFamily(line1Font) === "Hanover Graphic") {
		return graphic;
	}
	return [...DUAL_LINE_FONTS_BY_FAMILY("Hanover Super-X"), ...graphic];
}
