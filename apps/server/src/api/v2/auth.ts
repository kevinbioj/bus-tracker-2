import { discordAuth } from "@hono/oauth-providers/discord";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { database } from "../../core/database/database.js";
import { editorsTable } from "../../core/database/schema.js";
import type { HonoWithSession } from "../../server.js";

import { createJsonValidator } from "../validator-helpers.js";

const authApp = new Hono<HonoWithSession>();

authApp.use(
	"/discord",
	discordAuth({
		scope: ["identify"],
		client_id: process.env.DISCORD_OAUTH2_CLIENT_ID,
		client_secret: process.env.DISCORD_OAUTH2_CLIENT_SECRET,
		redirect_uri: process.env.DISCORD_OAUTH2_REDIRECT_URI,
	}),
	async (c) => {
		const user = c.get("user-discord");

		if (typeof user?.id === "undefined") {
			return c.json(
				{
					status: 500,
					code: "MISSING_USER",
					message: "Something wrong occurred while sign-in, please try again later.",
				},
				500,
			);
		}

		const [editor] = await database
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.discordId, user.id), eq(editorsTable.enabled, true)));

		if (typeof editor === "undefined") {
			return c.json(
				{
					status: 401,
					code: "UNKNOWN_USER",
					message: "No editor matches this Discord profile, please contact administrator.",
				},
				401,
			);
		}

		const session = c.get("session");
		session.set("userId", editor.id);

		return c.redirect("/", 302);
	},
);

authApp.post(
	"/token",
	createJsonValidator(z.object({ token: z.string({ error: "Expected authentication token to be supplied." }) })),
	async (c) => {
		const { token } = c.req.valid("json");

		const [editor] = await database
			.select()
			.from(editorsTable)
			.where(and(eq(editorsTable.token, token), eq(editorsTable.enabled, true)));

		if (typeof editor === "undefined") {
			return c.json(
				{
					status: 401,
					code: "UNKNOWN_USER",
					message: "No editor matches this token, please contact administrator.",
				},
				401,
			);
		}

		const session = c.get("session");
		session.set("userId", editor.id);

		return c.body(null, 204);
	},
);

authApp.post("/logout", async (c) => {
	const session = c.get("session");
	session.forget("userId");
	return c.body(null, 204);
});

export default authApp;
