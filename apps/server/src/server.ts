import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { CookieStore, sessionMiddleware, type Session } from "hono-sessions";
import { Temporal } from "temporal-polyfill";

import v2app from "./api/v2/index.js";
import type { EditorEntity } from "./core/database/schema.js";

type SessionData = {
	userId?: number;
};

export type HonoWithSession = {
	Variables: {
		session: Session<SessionData>;
		session_key_rotation: boolean;
		user?: EditorEntity;
	};
};

export const hono = new Hono<HonoWithSession>();

const sessionStore = new CookieStore();

hono.use(cors({ origin: "*" }));
hono.use(logger());
hono.use(
	"*",
	sessionMiddleware({
		store: sessionStore,
		encryptionKey: process.env.COOKIE_ENCRYPTION_KEY,
		expireAfterSeconds: Temporal.Duration.from({ days: 30 }).total("seconds"),
		autoExtendExpiration: true,
		cookieOptions: {
			sameSite: "strict",
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
		},
	}),
);

hono.route("/v2", v2app);

export type ServerApp = typeof hono;
