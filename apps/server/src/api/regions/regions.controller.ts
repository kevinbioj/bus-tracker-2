import { Hono } from "hono";

import { findAllRegions } from "./regions.service.js";

const regionController = new Hono();
export default regionController;

regionController.get("/", async (c) => {
	const regions = await findAllRegions();
	return c.json(regions);
});
