import ky from "ky";

export const client = ky.create({
	prefixUrl: import.meta.env.VITE_APP_API_URL,
});
