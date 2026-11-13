import type { Service } from "./service.js";

export type ServiceWindow = { from: Temporal.PlainDate; to: Temporal.PlainDate };

export const SERVICE_WINDOW_DAYS_BEFORE = 1;
export const SERVICE_WINDOW_DAYS_AFTER = 7;

export function createServiceWindow(today: Temporal.PlainDate): ServiceWindow {
	return {
		from: today.subtract({ days: SERVICE_WINDOW_DAYS_BEFORE }),
		to: today.add({ days: SERVICE_WINDOW_DAYS_AFTER }),
	};
}

export function createServiceWindowFilter(window: ServiceWindow) {
	const cache = new Map<Service, boolean>();
	return (service: Service) => {
		let runs = cache.get(service);
		if (runs === undefined) {
			runs = false;
			for (let date = window.from; Temporal.PlainDate.compare(date, window.to) <= 0; date = date.add({ days: 1 })) {
				if (service.runsOn(date)) {
					runs = true;
					break;
				}
			}
			cache.set(service, runs);
		}
		return runs;
	};
}

export function isServiceWindowOutdated(window: ServiceWindow, today: Temporal.PlainDate) {
	return Temporal.PlainDate.compare(window.to, createServiceWindow(today).to) < 0;
}
