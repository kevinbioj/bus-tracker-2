class WeakValueMap<K, V extends object> {
	private map = new Map<K, WeakRef<V>>();
	private registry = new FinalizationRegistry<K>((key) => {
		const ref = this.map.get(key);
		if (ref && !ref.deref()) {
			this.map.delete(key);
		}
	});

	get(key: K): V | undefined {
		const ref = this.map.get(key);
		if (!ref) return undefined;
		const value = ref.deref();
		if (!value) {
			this.map.delete(key);
			return undefined;
		}
		return value;
	}

	set(key: K, value: V) {
		this.map.set(key, new WeakRef(value));
		this.registry.register(value, key);
	}
}

const plainDateCache = new WeakValueMap<string, Temporal.PlainDate>();

export function createPlainDate(item: string) {
	let plainDate = plainDateCache.get(item);
	if (plainDate === undefined) {
		plainDate = Temporal.PlainDate.from(item);
		plainDateCache.set(item, plainDate);
	}
	return plainDate;
}

const plainTimeCache = new WeakValueMap<string, Temporal.PlainTime>();

export function createPlainTime(item: string) {
	let plainTime = plainTimeCache.get(item);
	if (plainTime === undefined) {
		plainTime = Temporal.PlainTime.from(item);
		plainTimeCache.set(item, plainTime);
	}
	return plainTime;
}

const zonedDateTimeCache = new WeakValueMap<string, Temporal.ZonedDateTime>();

export function createZonedDateTime(date: Temporal.PlainDate, time: Temporal.PlainTime, timeZone: string) {
	const key = `${date}_${time}_${timeZone}`;
	let zonedDateTime = zonedDateTimeCache.get(key);
	if (zonedDateTime === undefined) {
		zonedDateTime = date.toZonedDateTime({ plainTime: time, timeZone });
		zonedDateTimeCache.set(key, zonedDateTime);
	}
	return zonedDateTime;
}

/**
 * Construit une ZonedDateTime à partir d'une date "jour 0" et d'une heure
 * exprimée en secondes depuis minuit (modulus inclus, peut dépasser 86400).
 */
export function createZonedDateTimeFromSecs(date0: Temporal.PlainDate, secs: number, timeZone: string) {
	const days = Math.floor(secs / 86400);
	const dayOfTrip = days === 0 ? date0 : date0.add({ days });
	const remain = secs - days * 86400;
	const h = Math.floor(remain / 3600);
	const m = Math.floor((remain % 3600) / 60);
	const s = remain % 60;
	const time = createPlainTime(
		`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
	);
	return createZonedDateTime(dayOfTrip, time, timeZone);
}

type ServiceDay = {
	/** Instant (epoch ms) du minuit local du jour. */
	startMs: number;
	/** Vrai si le fuseau change d'heure ce jour-là : l'heure murale n'y est plus linéaire. */
	hasTransition: boolean;
};

/** Jours de service par fuseau, puis par date de départ (`YYYYMMDD`), puis par décalage en jours. */
const serviceDayCache = new Map<string, Map<number, ServiceDay[]>>();

/** Au-delà, le cache est vidé : il ne retient de toute façon que quelques jours par fuseau. */
const SERVICE_DAY_CACHE_MAX_DATES = 1024;

function computeServiceDay(date0: Temporal.PlainDate, days: number, timeZone: string): ServiceDay {
	const day = days === 0 ? date0 : date0.add({ days });
	const start = day.toZonedDateTime({ plainTime: "00:00:00", timeZone });
	const nextStart = day.add({ days: 1 }).toZonedDateTime({ plainTime: "00:00:00", timeZone });
	const transition = start.getTimeZoneTransition("next");
	return {
		startMs: start.epochMilliseconds,
		hasTransition:
			// Un minuit inexistant ou ambigu est déjà, en soi, un changement d'heure.
			start.toPlainTime().toString() !== "00:00:00" ||
			(transition !== null && transition.epochMilliseconds <= nextStart.epochMilliseconds),
	};
}

function getServiceDay(date0: Temporal.PlainDate, days: number, timeZone: string) {
	let byDate = serviceDayCache.get(timeZone);
	if (byDate === undefined) {
		byDate = new Map();
		serviceDayCache.set(timeZone, byDate);
	}

	const dateKey = date0.year * 10000 + date0.month * 100 + date0.day;
	let byOffset = byDate.get(dateKey);
	if (byOffset === undefined) {
		if (byDate.size >= SERVICE_DAY_CACHE_MAX_DATES) byDate.clear();
		byOffset = [];
		byDate.set(dateKey, byOffset);
	}

	let serviceDay = byOffset[days];
	if (serviceDay === undefined) {
		serviceDay = computeServiceDay(date0, days, timeZone);
		byOffset[days] = serviceDay;
	}
	return serviceDay;
}

/**
 * Instant (epoch ms) d'une heure exprimée en secondes depuis minuit du jour 0 (modulus inclus).
 * Même résultat que {@link createZonedDateTimeFromSecs} — l'heure murale du jour visé —, mais sans
 * construire d'objet Temporal : hors changement d'heure, c'est le minuit local plus les secondes.
 * Les jours de changement d'heure, deux par an et par fuseau, reprennent le calcul complet.
 */
export function getEpochMsFromSecs(date0: Temporal.PlainDate, secs: number, timeZone: string) {
	const days = Math.floor(secs / 86400);
	const serviceDay = getServiceDay(date0, days, timeZone);
	if (serviceDay.hasTransition) return createZonedDateTimeFromSecs(date0, secs, timeZone).epochMilliseconds;
	return serviceDay.startMs + (secs - days * 86400) * 1000;
}
