import { describe, expect, it } from "vitest";

import { resolveRequestLocale } from "./request-locale.js";

const browser = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("resolveRequestLocale", () => {
	it("falls back to French without Accept-Language", () => {
		expect(resolveRequestLocale(browser, undefined)).toBe("fr");
	});

	it("picks the first supported language by quality", () => {
		expect(resolveRequestLocale(browser, "en-GB,en;q=0.9,fr;q=0.8")).toBe("en");
		expect(resolveRequestLocale(browser, "fr;q=0.5, de-DE;q=0.9")).toBe("de");
		expect(resolveRequestLocale(browser, "it-IT,it;q=0.9,de;q=0.7,en;q=0.8")).toBe("en");
	});

	it("ignores refused and unsupported languages", () => {
		expect(resolveRequestLocale(browser, "en;q=0, es")).toBe("fr");
		expect(resolveRequestLocale(browser, "*")).toBe("fr");
	});

	it("serves crawlers in French whatever they accept", () => {
		expect(resolveRequestLocale(googlebot, "en-US,en;q=0.9")).toBe("fr");
	});
});
