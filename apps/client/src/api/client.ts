import ky from "ky";

export const API_URL_PREFIX = import.meta.env.VITE_APP_API_URL ?? "/api";

export const client = ky.create({
	credentials: "include",
	prefix: API_URL_PREFIX,
});
