/**
 * A faster version of Temporal.ZonedDateTime.toString({ timeZoneName: "never" })
 * using native Date and manual offset calculation.
 * To be removed whenever Temporal gets fast enough.
 */
const offsetStringCache = new Map<number, string>();
export function fastFormatISO(epochMs: number, offsetMs: number): string {
	const date = new Date(epochMs + offsetMs);
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth() + 1;
	const d = date.getUTCDate();
	const hh = date.getUTCHours();
	const mm = date.getUTCMinutes();
	const ss = date.getUTCSeconds();

	let offsetStr = offsetStringCache.get(offsetMs);
	if (offsetStr === undefined) {
		const absOffset = Math.abs(offsetMs);
		const oH = Math.floor(absOffset / 3600000);
		const oM = Math.floor((absOffset % 3600000) / 60000);
		const sign = offsetMs >= 0 ? "+" : "-";
		offsetStr = `${sign + (oH < 10 ? `0${oH}` : oH)}:${oM < 10 ? `0${oM}` : oM}`;
		offsetStringCache.set(offsetMs, offsetStr);
	}

	return (
		y +
		"-" +
		(m < 10 ? `0${m}` : m) +
		"-" +
		(d < 10 ? `0${d}` : d) +
		"T" +
		(hh < 10 ? `0${hh}` : hh) +
		":" +
		(mm < 10 ? `0${mm}` : mm) +
		":" +
		(ss < 10 ? `0${ss}` : ss) +
		offsetStr
	);
}

/**
 * Get the timezone offset in milliseconds for a given timezone at a specific epoch.
 * We cache this per journey to avoid repeated calculations.
 */
const offsetCache = new Map<string, number>();
export function getTimeZoneOffsetMs(timeZone: string, epochMs: number): number {
	const cacheKey = `${timeZone}_${Math.floor(epochMs / 3600000)}`; // Cache hourly to handle DST transitions
	let offset = offsetCache.get(cacheKey);
	if (offset === undefined) {
		const dt = new Date(epochMs);
		const utcDate = new Date(dt.toLocaleString("en-US", { timeZone: "UTC" }));
		const tzDate = new Date(dt.toLocaleString("en-US", { timeZone }));
		offset = tzDate.getTime() - utcDate.getTime();
		offsetCache.set(cacheKey, offset);

		// Plafond large : un jeu de données continental combine une dizaine de fuseaux à autant
		// d'heures distinctes, une purge trop précoce annulerait le bénéfice du cache.
		if (offsetCache.size > 8192) offsetCache.clear();
	}
	return offset;
}

/**
 * Sérialise l'heure d'un arrêt avec l'offset de *son* fuseau à *cet* instant : une course peut
 * traverser plusieurs fuseaux, et un changement d'heure.
 */
export function formatCallTime(epochMs: number, stopTimeZone: string | undefined, journeyTimeZone: string): string {
	return fastFormatISO(epochMs, getTimeZoneOffsetMs(stopTimeZone ?? journeyTimeZone, epochMs));
}
