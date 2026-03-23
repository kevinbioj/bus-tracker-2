import { describe, expect, it } from "vitest";
import { getAuthHeaders } from "./auth.js";

describe("getAuthHeaders", () => {
	it("returns an empty object when no auth is provided", () => {
		expect(getAuthHeaders(undefined)).toEqual({});
	});

	it("returns basic auth headers when type is basic", () => {
		const auth = {
			type: "basic" as const,
			username: "user",
			password: "password",
		};
		const headers = getAuthHeaders(auth);
		expect(headers).toEqual({
			Authorization: "Basic dXNlcjpwYXNzd29yZA==",
		});
	});

	it("returns basic auth headers with empty fields when type is basic and fields are missing", () => {
		const auth = {
			type: "basic" as const,
		};
		const headers = getAuthHeaders(auth);
		expect(headers).toEqual({
			Authorization: "Basic Og==", // ":" in base64
		});
	});

	it("returns custom header when type is header", () => {
		const auth = {
			type: "header" as const,
			name: "X-API-Key",
			value: "my-secret-key",
		};
		const headers = getAuthHeaders(auth);
		expect(headers).toEqual({
			"X-API-Key": "my-secret-key",
		});
	});
});
