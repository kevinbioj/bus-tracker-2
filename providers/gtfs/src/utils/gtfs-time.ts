/** Convertit "HH:MM:SS" (HH peut dépasser 24) en secondes depuis minuit du jour 0. */
export function parseGtfsTime(time: string): number {
	const c1 = time.indexOf(":");
	const c2 = time.indexOf(":", c1 + 1);
	const h = +time.slice(0, c1);
	const m = +time.slice(c1 + 1, c2);
	const s = +time.slice(c2 + 1);
	return h * 3600 + m * 60 + s;
}

export function formatGtfsTime(secs: number) {
	const pad = (value: number) => value.toString().padStart(2, "0");
	return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}
