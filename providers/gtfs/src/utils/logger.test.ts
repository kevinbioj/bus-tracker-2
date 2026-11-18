import { afterEach, describe, expect, it, vi } from "vitest";

import { alignLogScopes, createLogger, describeError, formatLogLine } from "./logger.js";

describe("logger", () => {
	afterEach(() => {
		alignLogScopes([]);
		vi.restoreAllMocks();
	});

	it("aligne les sources sur la plus longue", () => {
		alignLogScopes(["tcl", "slowimport"]);

		expect(formatLogLine("INFO", "tcl", "Computed 20 journeys")).toMatch(
			/^\d{4}-\d{2}-\d{2}T[\d:.]+Z INFO {2}\[tcl {7}\] Computed 20 journeys$/,
		);
		expect(formatLogLine("ERROR", "slowimport", "GTFS import failed")).toMatch(
			/ ERROR \[slowimport\] GTFS import failed$/,
		);
	});

	it("résume une erreur et ses causes sur une ligne", () => {
		const timeout = new Error("The operation was aborted due to timeout");
		timeout.name = "TimeoutError";
		const error = new Error("Failed to download feed", { cause: timeout });

		expect(describeError(error)).toBe(
			"Failed to download feed ← TimeoutError: The operation was aborted due to timeout",
		);
		expect(describeError("boom")).toBe("boom");
	});

	it("écrit chaque niveau sur la sortie correspondante", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const logger = createLogger("tcl");

		logger.info("Computed 20 journeys");
		logger.warn("Feed is slow");
		logger.error("Feed failed", new Error("404"));

		expect(log.mock.calls[0]![0]).toMatch(/INFO {2}\[tcl {5}\] Computed 20 journeys$/);
		expect(warn.mock.calls[0]![0]).toMatch(/WARN {2}\[tcl {5}\] Feed is slow$/);
		expect(error.mock.calls[0]![0]).toMatch(/ERROR \[tcl {5}\] Feed failed: 404$/);
	});
});
