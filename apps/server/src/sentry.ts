import * as Sentry from "@sentry/bun";

const dsn = process.env.SENTRY_DSN;
if (typeof dsn !== "undefined") {
	Sentry.init({
		dsn,
		tracesSampleRate: 1.0,
	});
}
