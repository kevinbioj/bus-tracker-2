export const ALLOWED_FONT_FAMILIES = {
	"Hanover Graphic": ["0808B2E1", "1310C2E1", "1508C2E1", "1510N2E1", "1513B3E1"],
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
};

export const DEFAULT_FONT_FAMILY: AllowedFontFamily = "Hanover Graphic";
export const DEFAULT_FONT_VARIANT: AllowedFont = "1513B3E1";

export function getFontFamily(fontVariant: string): AllowedFontFamily {
	for (const [family, fonts] of Object.entries(ALLOWED_FONT_FAMILIES) as [AllowedFontFamily, readonly string[]][]) {
		if (fonts.includes(fontVariant)) return family;
	}
	return DEFAULT_FONT_FAMILY;
}
