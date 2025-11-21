export const requestorRef = "WWW.BUS-TRACKER.FR";

export const siriEndpoint = "https://api.okina.fr/gateway/cae/realtime/anshar/ws/services";

export const apiKey = process.env.API_KEY;

if (typeof apiKey === "undefined") {
	throw new TypeError("Expected 'API_KEY' environment variable to be defined.");
}
