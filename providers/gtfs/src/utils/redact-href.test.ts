import { describe, expect, it } from "vitest";

import { redactHref } from "./redact-href.js";

describe("redactHref", () => {
	it("removes the userinfo from an URL", () => {
		expect(redactHref("https://user:hunter2@gtfs.bus-tracker.fr/private/bagnoles.zip", {}).href).toBe(
			"https://gtfs.bus-tracker.fr/private/bagnoles.zip",
		);
	});

	it("redacts sensitive query parameters", () => {
		expect(redactHref("https://alto.maxtrip.fr/api/v1/Export/Gtfs/alto?apiKey=s3cr3tvalue", {}).href).toBe(
			"https://alto.maxtrip.fr/api/v1/Export/Gtfs/alto?apiKey=***",
		);
		expect(redactHref("https://api.okina.fr/gateway/realtime/NAOLIBORG?api-key=s3cr3tvalue", {}).href).toBe(
			"https://api.okina.fr/gateway/realtime/NAOLIBORG?api-key=***",
		);
	});

	it("redacts environment secrets interpolated inside the path", () => {
		const href = "https://saintloagglo.plateforme-2cloud.com/api/gtfsrt/2.0/vehiclepositions/abcdef123456/bin";
		expect(redactHref(href, { SLAMBUS_API_KEY: "abcdef123456" }).href).toBe(
			"https://saintloagglo.plateforme-2cloud.com/api/gtfsrt/2.0/vehiclepositions/***/bin",
		);
	});

	it("keeps the hostname intact when a credential looks like a domain fragment", () => {
		// Régression : un identifiant valant « bus-tracker » masquait l'hôte de toutes les URLs.
		const href = "https://gtfs.bus-tracker.fr/lia.zip";
		expect(
			redactHref(href, {
				GTFS_PRIVATE_AUTH_USERNAME: "bus-tracker",
				GTFS_PRIVATE_AUTH_PASSWORD: "bus-tracker",
			}),
		).toEqual({ href, redacted: false });
	});

	it("never redacts a secret found in the hostname", () => {
		expect(redactHref("https://abcdef123456.example.com/feed.zip", { FEED_API_KEY: "abcdef123456" }).href).toBe(
			"https://abcdef123456.example.com/feed.zip",
		);
	});

	it("ignores environment variables that are not sensitive or too short", () => {
		const href = "https://gtfs.bus-tracker.fr/lia.zip";
		expect(redactHref(href, { REDIS_URL: "https://gtfs.bus-tracker.fr", API_KEY: "lia" }).href).toBe(href);
		// Un nom d'identité est écarté même quand il contient un mot sensible.
		expect(redactHref("https://example.com/lia.zip", { FEED_AUTH_USERNAME: "lia.zip" }).href).toBe(
			"https://example.com/lia.zip",
		);
	});

	it("leaves secret-free URLs untouched", () => {
		const href = "https://api.atm.cityway.fr/dataflow/offre-tc/download?provider=SEMO&dataFormat=GTFS";
		expect(redactHref(href, {}).href).toBe(href);
	});

	it("still redacts environment secrets when the href is not a valid URL", () => {
		expect(redactHref("gtfs-rt/poll?token=abcdef123456", { FEED_TOKEN: "abcdef123456" }).href).toBe(
			"gtfs-rt/poll?token=***",
		);
	});
});

describe("redactHref reporting", () => {
	it("reports a redaction when a credential is removed", () => {
		expect(redactHref("https://user:hunter2@example.com/feed.zip", {}).redacted).toBe(true);
		expect(redactHref("https://example.com/feed.zip?apiKey=s3cr3tvalue", {}).redacted).toBe(true);
		expect(redactHref("https://example.com/abcdef123456/feed.zip", { FEED_API_KEY: "abcdef123456" }).redacted).toBe(
			true,
		);
	});

	it("reports no redaction for a public URL", () => {
		expect(redactHref("https://gtfs.bus-tracker.fr/lia.zip", {}).redacted).toBe(false);
		expect(redactHref("https://example.com/feed?provider=SEMO", {}).redacted).toBe(false);
	});

	it("does not treat an empty sensitive parameter as a credential", () => {
		expect(redactHref("https://example.com/feed?token=", {}).redacted).toBe(false);
	});
});
