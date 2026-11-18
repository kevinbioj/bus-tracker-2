type Level = "INFO" | "WARN" | "ERROR";

export type Logger = {
	info(message: string): void;
	warn(message: string, error?: unknown): void;
	error(message: string, error?: unknown): void;
};

const PROVIDER_SCOPE = "provider";

let scopeWidth = PROVIDER_SCOPE.length;

export function alignLogScopes(scopes: string[]) {
	scopeWidth = Math.max(PROVIDER_SCOPE.length, ...scopes.map((scope) => scope.length));
}

export function describeError(error: unknown) {
	const parts: string[] = [];
	let current: unknown = error;
	while (current !== undefined && parts.length < 8) {
		if (current instanceof Error) {
			parts.push(current.name === "Error" ? current.message : `${current.name}: ${current.message}`);
			current = current.cause;
		} else {
			parts.push(String(current));
			current = undefined;
		}
	}
	return parts.join(" ← ");
}

export function formatLogLine(level: Level, scope: string, message: string, error?: unknown) {
	const details = error === undefined ? "" : `: ${describeError(error)}`;
	return `${new Date().toISOString()} ${level.padEnd(5)} [${scope.padEnd(scopeWidth)}] ${message}${details}`;
}

export function createLogger(scope: string): Logger {
	return {
		info: (message) => console.log(formatLogLine("INFO", scope, message)),
		warn: (message, error) => console.warn(formatLogLine("WARN", scope, message, error)),
		error: (message, error) => console.error(formatLogLine("ERROR", scope, message, error)),
	};
}

export const providerLog = createLogger(PROVIDER_SCOPE);
