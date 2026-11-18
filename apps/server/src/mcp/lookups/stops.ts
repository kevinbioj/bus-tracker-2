import { resolveStop as resolveBoardStop } from "../../core/services/stop-board-service.js";
import { ToolFailure } from "../define-tool.js";

export async function resolveStop(ref: string) {
	const stop = await resolveBoardStop(ref);
	if (stop === undefined) {
		throw new ToolFailure(`No stop found for ref "${ref}". Use search_stops or find_stops_nearby.`);
	}
	return stop;
}
