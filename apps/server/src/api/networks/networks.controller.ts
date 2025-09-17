import { Hono } from "hono";
import z from "zod";

import { createParamValidator } from "../../helpers/validator-helpers.js";

import { findAllNetworks, findNetworkById } from "./networks.service.js";

const networkController = new Hono();
export default networkController;

networkController.get("/", async (c) => {
	const networks = await findAllNetworks();
	return c.json(networks);
});

networkController.get("/:id", createParamValidator(z.object({ id: z.coerce.number().int() })), async (c) => {
	const { id } = c.req.valid("param");
	const network = await findNetworkById(id);
	return c.json(network);
});
