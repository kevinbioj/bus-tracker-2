import ky from "ky";

export const client = ky.create({
	prefix: import.meta.env.VITE_APP_API_URL ?? "/api",
});
