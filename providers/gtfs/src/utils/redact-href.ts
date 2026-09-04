/** Noms de paramètres de requête dont la valeur est systématiquement masquée. */
const SENSITIVE_QUERY_PARAM = /^(api[-_]?key|key|token|secret|password|pass|auth|signature)$/i;

/** Noms de variables d'environnement dont la valeur est considérée comme un secret. */
const SENSITIVE_ENV_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|SIGNATURE/i;

/**
 * Noms désignant une identité ou un emplacement plutôt qu'un secret. Un identifiant de connexion
 * ressemble souvent à un fragment de domaine ou de chemin : le masquer défigurerait des URLs
 * publiques sans rien protéger, l'authentification incluse dans l'URL étant déjà retirée.
 */
const IDENTITY_ENV_NAME = /USER|LOGIN|NAME|HOST|URL|PORT|MAIL/i;

/** Longueur en deçà de laquelle une valeur est trop banale pour être masquée sans faux positif. */
const MIN_SECRET_LENGTH = 8;

const REDACTED = "***";

function collectSecrets(env: Record<string, string | undefined>) {
	return Object.entries(env).flatMap(([name, value]) =>
		typeof value === "string" &&
		value.length >= MIN_SECRET_LENGTH &&
		SENSITIVE_ENV_NAME.test(name) &&
		!IDENTITY_ENV_NAME.test(name)
			? [value]
			: [],
	);
}

function redactSecrets(text: string, secrets: string[]) {
	let redacted = false;

	const result = secrets.reduce((current, secret) => {
		if (!current.includes(secret)) return current;
		redacted = true;
		return current.replaceAll(secret, REDACTED);
	}, text);

	return { text: result, redacted };
}

export type RedactedHref = {
	href: string;
	/** Vrai si un identifiant a effectivement été retiré, donc si la source en requiert un. */
	redacted: boolean;
};

/**
 * Masque les secrets d'une URL de flux avant de la publier : l'authentification incluse dans l'URL,
 * les paramètres de requête au nom explicite, et toute valeur d'environnement sensible retrouvée
 * dans le chemin ou la requête — les configurations interpolent régulièrement une clé d'API
 * directement dans le chemin (`.../vehiclepositions/${SLAMBUS_API_KEY}/bin`).
 *
 * Le protocole et le nom d'hôte sont laissés intacts : aucun secret n'y réside, et les y chercher
 * reviendrait à casser des URLs parfaitement publiques.
 */
export function redactHref(href: string, env: Record<string, string | undefined> = process.env): RedactedHref {
	const secrets = collectSecrets(env);

	let url: URL;
	try {
		url = new URL(href);
	} catch {
		// URL non analysable (href relatif, gabarit) : seule la passe environnement s'applique.
		const { text, redacted } = redactSecrets(href, secrets);
		return { href: text, redacted };
	}

	let redacted = false;

	if (url.username !== "" || url.password !== "") {
		url.username = "";
		url.password = "";
		redacted = true;
	}

	for (const name of [...url.searchParams.keys()]) {
		if (!SENSITIVE_QUERY_PARAM.test(name)) continue;
		// Un paramètre sensible mais vide ne révèle rien : ne pas le compter comme un identifiant.
		if ((url.searchParams.get(name) ?? "") !== "") redacted = true;
		url.searchParams.set(name, REDACTED);
	}

	const path = redactSecrets(`${url.pathname}${url.search}${url.hash}`, secrets);

	return {
		href: `${url.protocol}//${url.host}${path.text}`,
		redacted: redacted || path.redacted,
	};
}
