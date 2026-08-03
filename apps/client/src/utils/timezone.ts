import dayjs, { type ConfigType } from "dayjs";

const timezoneSupport = new Map<string, boolean>();

/**
 * Renvoie le fuseau horaire s'il est utilisable par le navigateur, sinon `undefined`.
 *
 * Tous les navigateurs n'embarquent pas la même base de fuseaux horaires : ceux dont
 * les données ICU sont incomplètes ou trop anciennes lèvent une erreur à la création
 * d'un `Intl.DateTimeFormat` (par exemple `TypeError: failed to initialize DateTimeFormat`
 * sur WebKit). Comme dayjs ne rattrape pas cette erreur, un fuseau inconnu du navigateur
 * fait planter tout le rendu : on préfère alors retomber sur le fuseau local.
 */
export function resolveTimezone(timezone?: string) {
	if (timezone === undefined) return undefined;

	let isSupported = timezoneSupport.get(timezone);
	if (isSupported === undefined) {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" });
			isSupported = true;
		} catch {
			isSupported = false;
		}
		timezoneSupport.set(timezone, isSupported);
	}

	return isSupported ? timezone : undefined;
}

/** Équivalent de `dayjs(date).tz(timezone)`, en ignorant les fuseaux non supportés. */
export function dayjsTz(date: ConfigType, timezone?: string) {
	return dayjs(date).tz(resolveTimezone(timezone));
}
