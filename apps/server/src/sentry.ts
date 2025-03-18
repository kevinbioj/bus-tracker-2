import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (typeof dsn !== "undefined") {
	Sentry.init({
		dsn,
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
	});
}
