import * as z from "zod";

import { getNetworkDataSources } from "../core/services/data-source-service.js";
import { hono } from "../server.js";
import { createParamValidator, idSchema } from "../utils/validator-helpers.js";

const getNetworkDataSourcesParamSchema = z.object({
	id: idSchema,
});

hono.get("/data-sources", async (c) => {
	return c.json(await getNetworkDataSources());
});

hono.get("/networks/:id/data-sources", createParamValidator(getNetworkDataSourcesParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const networkDataSources = await getNetworkDataSources();
	const entry = networkDataSources.find(({ network }) => network.id === id);
	return c.json(entry?.sources ?? []);
});
