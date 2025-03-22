import Plausible from "plausible-tracker";

export const plausible = Plausible({
	apiHost: "https://plausible.bus-tracker.fr",
	domain: "bus-tracker.fr",
	trackLocalhost: false,
});

plausible.enableAutoOutboundTracking();
plausible.enableAutoPageviews();
