import ky from "ky";

export const API_URL_PREFIX = import.meta.env.VITE_APP_API_URL ?? "/api";

export const client = ky.create({
	credentials: "include",
	prefix: API_URL_PREFIX,
});

export function toSearchParams(
	params: Record<string, string | undefined>,
	lists: Record<string, readonly number[] | undefined> = {},
) {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) searchParams.append(key, value);
	}
	for (const [key, values] of Object.entries(lists)) {
		for (const value of values ?? []) searchParams.append(key, String(value));
	}
	return searchParams;
}
