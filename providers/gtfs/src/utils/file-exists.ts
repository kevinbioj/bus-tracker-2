import { access } from "node:fs/promises";

export const fileExists = (path: string) =>
	access(path)
		.then(() => true)
		.catch(() => false);
