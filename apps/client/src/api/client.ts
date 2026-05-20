import ky from "ky";

export const client = ky.create({
	credentials: "include",
	prefix: import.meta.env.VITE_APP_API_URL ?? "/api",
});
