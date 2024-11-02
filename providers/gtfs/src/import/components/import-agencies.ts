import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { Agency } from "../../model/agency.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

type AgencyRecord = CsvRecord<"agency_id" | "agency_name" | "agency_timezone">;

export async function importAgencies(gtfsDirectory: string) {
	const agencies = new Map<string, Agency>();

	await readCsv<AgencyRecord>(join(gtfsDirectory, "agency.txt"), (agencyRecord) => {
		const agency = new Agency(
			agencyRecord.agency_id,
			agencyRecord.agency_name,
			new Temporal.TimeZone(agencyRecord.agency_timezone),
		);

		agencies.set(agency.id, agency);
	});

	return agencies;
}
