import { Buffer } from "node:buffer";

export type SourceAuth =
	| {
			type: "basic";
			username?: string;
			password?: string;
	  }
	| {
			type: "header";
			name: string;
			value: string;
	  };

export function getAuthHeaders(auth?: SourceAuth): Record<string, string> {
	if (auth === undefined) return {};

	if (auth.type === "basic") {
		const credentials = Buffer.from(`${auth.username ?? ""}:${auth.password ?? ""}`).toString("base64");
		return {
			Authorization: `Basic ${credentials}`,
		};
	}

	return {
		[auth.name]: auth.value,
	};
}
