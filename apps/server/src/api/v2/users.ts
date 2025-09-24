import { inArray } from "drizzle-orm";
import { Hono } from "hono";

import { database } from "../../core/database/database.js";
import { networksTable } from "../../core/database/schema.js";

import { authMiddleware } from "../auth-middleware.js";

const usersApp = new Hono();

usersApp.get("/@me", authMiddleware({}), async (c) => {
	const user = c.get("user")!;

	const manageableNetworks = await database
		.select()
		.from(networksTable)
		.where(inArray(networksTable.id, Array.isArray(user.manageableNetworks) ? user.manageableNetworks : []));

	return c.json(
		{
			id: user.id,
			username: user.username,
			role: user.role,
			manageableNetworks: manageableNetworks.map((network) => ({ id: network.id, name: network.name })),
			createdAt: user.createdAt,
		},
		200,
	);
});

export default usersApp;
