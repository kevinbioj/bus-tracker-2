import { join } from "node:path";

import { createPlainDate } from "../../cache/temporal-cache.js";
import { Service } from "../../model/service.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { fileExists } from "../../utils/file-exists.js";

type ServiceRecord = CsvRecord<
	| "service_id"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday"
	| "start_date"
	| "end_date"
>;

type ExceptionRecord = CsvRecord<"service_id" | "date" | "exception_type">;

export async function importServices(gtfsDirectory: string) {
	const services = new Map<string, Service>();

	const calendarFile = join(gtfsDirectory, "calendar.txt");
	if (await fileExists(calendarFile)) {
		await readCsv<ServiceRecord>(calendarFile, (serviceRecord) => {
			const service = new Service(
				serviceRecord.service_id,
				[
					!!+serviceRecord.monday,
					!!+serviceRecord.tuesday,
					!!+serviceRecord.wednesday,
					!!+serviceRecord.thursday,
					!!+serviceRecord.friday,
					!!+serviceRecord.saturday,
					!!+serviceRecord.sunday,
				],
				createPlainDate(serviceRecord.start_date),
				createPlainDate(serviceRecord.end_date),
			);

			services.set(service.id, service);
		});
	}

	const calendarDatesFile = join(gtfsDirectory, "calendar_dates.txt");
	if (await fileExists(calendarDatesFile)) {
		await readCsv<ExceptionRecord>(calendarDatesFile, (exceptionRecord) => {
			let service = services.get(exceptionRecord.service_id);
			if (typeof service === "undefined") {
				service = new Service(exceptionRecord.service_id);
				services.set(service.id, service);
			}

			const date = createPlainDate(exceptionRecord.date);
			if (exceptionRecord.exception_type === "1") {
				service.includedDates.push(date);
			} else {
				service.excludedDates.push(date);
			}
		});
	}

	return services;
}
