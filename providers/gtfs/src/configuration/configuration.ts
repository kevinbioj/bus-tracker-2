import type { RedisClientOptions } from "redis";

import type { Source } from "../model/source.js";

export type Configuration = {
	computeDelayMs: number;
	redisOptions: RedisClientOptions;
	sources: Source[];
};
