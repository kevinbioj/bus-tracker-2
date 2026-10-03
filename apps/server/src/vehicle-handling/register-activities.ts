import { DrizzleQueryError, sql } from "drizzle-orm";
import postgres from "postgres";

import { database } from "../core/database/database.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

const ACTIVITY_THRESHOLD_MNS = 90;

/**
 * Délai en deçà duquel une activité déjà enregistrée sur la même ligne n'est pas réécrite. Les
 * courses arrivent à chaque cycle des providers, soit toutes les dix secondes pour certains : écrire
 * à chacune ferait de `line_activity` et `vehicle` les tables les plus réécrites de la base, pour une
 * précision dont l'application n'a pas l'usage — un véhicule n'y est hors ligne qu'après 10 min.
 */
const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

type RegisterActivityInput = {
	vehicle_id: number;
	line_id: number;
	recorded_at: string;
	service_date: string;
};

type LastWrite = { lineId: number; recordedAtMs: number };

/** Dernière activité écrite par véhicule. */
const lastWrites = new Map<number, LastWrite>();
let lastSweepAtMs = Date.now();

/** Vrai si l'activité apporte quelque chose de plus que la dernière écrite pour ce véhicule. */
export function isActivityWriteDue(lastWrite: LastWrite | undefined, lineId: number, recordedAtMs: number) {
	if (lastWrite === undefined || lastWrite.lineId !== lineId) return true;
	return recordedAtMs - lastWrite.recordedAtMs >= ACTIVITY_WRITE_INTERVAL_MS;
}

/** Oublie les véhicules qu'aucune activité ne prolongera plus : leur prochaine écriture est due. */
function sweepLastWrites(nowMs: number) {
	if (nowMs - lastSweepAtMs < ACTIVITY_THRESHOLD_MNS * 60_000) return;
	lastSweepAtMs = nowMs;
	for (const [vehicleId, { recordedAtMs }] of lastWrites) {
		if (nowMs - recordedAtMs >= ACTIVITY_THRESHOLD_MNS * 60_000) lastWrites.delete(vehicleId);
	}
}

const performRegistration = async (inputs: RegisterActivityInput[], retryCount = 3): Promise<boolean> => {
	try {
		await database.execute(
			sql`SELECT register_activities(${JSON.stringify(inputs)}::jsonb, ${ACTIVITY_THRESHOLD_MNS}::integer)`,
		);
		return true;
	} catch (error) {
		if (
			error instanceof DrizzleQueryError &&
			error.cause instanceof postgres.PostgresError &&
			error.cause?.code === "40P01"
		) {
			if (retryCount === 0) {
				return false;
			}

			return performRegistration(inputs, retryCount - 1);
		}

		console.error(error);
		return false;
	}
};

export async function registerActivities(vehicleJourneys: DisposeableVehicleJourney[]) {
	const nowMs = Date.now();
	sweepLastWrites(nowMs);

	const activities: RegisterActivityInput[] = [];
	const writes = new Map<number, LastWrite>();

	for (const vehicleJourney of vehicleJourneys) {
		if (vehicleJourney.lineId === undefined || vehicleJourney.vehicle?.id === undefined) {
			continue;
		}

		const vehicleId = vehicleJourney.vehicle.id;
		// Le fuseau de la position est ramené à UTC : les colonnes `timestamp` ignorent le décalage.
		const recordedAt = Temporal.Instant.from(vehicleJourney.position.recordedAt);
		if (!isActivityWriteDue(lastWrites.get(vehicleId), vehicleJourney.lineId, recordedAt.epochMilliseconds)) {
			continue;
		}

		activities.push({
			vehicle_id: vehicleId,
			line_id: vehicleJourney.lineId,
			recorded_at: recordedAt.toString(),
			service_date: (vehicleJourney.serviceDate
				? Temporal.PlainDate.from(vehicleJourney.serviceDate)
				: Temporal.Now.plainDateISO()
			).toString(),
		});
		writes.set(vehicleId, { lineId: vehicleJourney.lineId, recordedAtMs: recordedAt.epochMilliseconds });
	}

	if (activities.length === 0) {
		return;
	}

	// Ordre stable des verrous de ligne : deux transactions concurrentes les prennent dans le même ordre.
	activities.sort((a, b) => a.vehicle_id - b.vehicle_id);

	if (await performRegistration(activities)) {
		for (const [vehicleId, write] of writes) lastWrites.set(vehicleId, write);
	}
}
