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
