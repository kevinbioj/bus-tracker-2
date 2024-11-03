import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import type { Source } from "../model/source.js";
import { createStopWatch } from "../utils/stop-watch.js";

export async function initializeResources(sources: Source[]) {
	const initLimit = 4;
	const initLimitFn = pLimit(initLimit);
	const initWatch = createStopWatch();
	console.log("%s ► Loading resources (concurrency limit: %d).", Temporal.Now.instant(), initLimit);

	const results = await Promise.allSettled(sources.map((source) => initLimitFn(() => source.importGtfs())));
	for (const result of results) {
		if (result.status !== "rejected") continue;
		console.log();
		console.error(result.reason);
		console.log();
	}

	console.log("✓ Load complete in %dms.\n", initWatch.total());
	console.log("► Initialization is complete.\n");
}
