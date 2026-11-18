import { findStopArea, findStopAreaOfStopPoint, type StopArea } from "../../core/services/stop-area-service.js";
import { ToolFailure } from "../define-tool.js";

export type ResolvedStop = { stopArea: StopArea; stopPointRef?: string; stopRefs: Set<string> };

const isStopPointRef = (ref: string) => ref.includes(":StopPoint:");

export async function resolveStop(ref: string): Promise<ResolvedStop> {
	const stopPointRef = isStopPointRef(ref) ? ref : undefined;
	const stopArea = await (stopPointRef !== undefined ? findStopAreaOfStopPoint(ref) : findStopArea(ref));
	if (stopArea === undefined) {
		throw new ToolFailure(`No stop found for ref "${ref}". Use search_stops or find_stops_nearby.`);
	}
	return {
		stopArea,
		stopPointRef,
		stopRefs: new Set(stopPointRef !== undefined ? [stopPointRef] : stopArea.stopRefs),
	};
}
