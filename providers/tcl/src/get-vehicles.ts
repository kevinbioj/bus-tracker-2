import { createDecipheriv } from "node:crypto";

if (typeof process.env.DECRYPTION_KEY === "undefined") {
	throw new Error('Please supply "DECRYPTION_KEY" environment variable');
}

const WS_ENDPOINT = "https://antilope-gp.ovh/Vehicules";

type WSResponse = {
	iv: string;
	cipherText: string;
};

type WSVehicule = {
	NumeroCarrosserie: number;
	Ligne: string;
	Sens: "ALL" | "RET";
	Destination: string;
	ProchainArret: string;
	X: number;
	Y: number;
	Cap: number;
};

type WSContent = {
	Vehicules: WSVehicule[];
	Total: number;
	ping: number;
};

export async function getVehicles(lines: { Ligne: string; Sens: "ALL" | "RET" }[]): Promise<WSContent> {
	const then = Date.now();
	const response = await fetch(WS_ENDPOINT, {
		body: JSON.stringify({
			Lignes: lines,
		}),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const ping = Date.now() - then;

	if (!response.ok) {
		throw new Error(`Failed to fetch data from server (HTTP ${response.status})`);
	}

	const payload = (await response.json()) as WSResponse;

	const decipher = createDecipheriv(
		"aes-128-cbc",
		Buffer.from(process.env.DECRYPTION_KEY!, "base64"),
		Buffer.from(payload.iv, "base64"),
	);

	const serializedContent = decipher.update(payload.cipherText, "base64", "utf-8") + decipher.final("utf-8");
	return {
		...JSON.parse(serializedContent),
		ping,
	};
}
