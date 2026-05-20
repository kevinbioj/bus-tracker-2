import { queryOptions } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { client } from "~/api/client";

export type Editor = {
	id: number;
	username: string;
	lastSeenAt: string | null;
	allowedNetworks: number[];
	createdAt: string;
};

export async function getEditorSelf() {
	try {
		return await client.get("/editors/@me").then((response) => response.json<Editor>());
	} catch (error) {
		if (error instanceof HTTPError && error.response.status === 401) return null;
		throw error;
	}
}

export function getLegacyEditorToken() {
	const value = localStorage.getItem("editor-token");
	if (value === null) return null;

	try {
		const parsed = JSON.parse(value) as unknown;
		return typeof parsed === "string" ? parsed : null;
	} catch {
		return value;
	}
}

export async function loginEditor(token: string) {
	return await client.post("/editors/session", { json: { token } }).then((response) => response.json<Editor>());
}

export async function logoutEditor() {
	await client.delete("/editors/session");
}

export const GetEditorSelf = queryOptions({
	queryKey: ["editor"],
	queryFn: getEditorSelf,
	retry: false,
});
