import { Buffer } from "node:buffer";
import type { SourceAuth } from "../model/source.js";

export function getAuthHeaders(auth?: SourceAuth): Record<string, string> {
	if (auth === undefined) return {};

	if (auth.type === "basic") {
		const credentials = Buffer.from(`${auth.username ?? ""}:${auth.password ?? ""}`).toString("base64");
		return {
			Authorization: `Basic ${credentials}`,
		};
	}

	if (auth.type === "header") {
		return {
			[auth.name]: auth.value,
		};
	}

	return {};
}
