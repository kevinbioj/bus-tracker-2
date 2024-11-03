import type { RedisClientOptions } from "redis";

import type { SourceOptions } from "../model/source.js";

export type Configuration = {
	computeDelayMs: number;
	redisOptions: RedisClientOptions;
	sources: ({ id: string } & SourceOptions)[];
};
