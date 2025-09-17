import type { LineEntity, NetworkEntity, RegionEntity } from "../../database/schema.js";

export const networkToNetworkDto = (network: NetworkEntity, region?: RegionEntity | null, lines?: LineEntity[]) => ({
	id: network.id,
	name: network.name,
	authority: network.authority,
	logo: { default: network.logoHref, dark: network.darkModeLogoHref },
	region: region ? { id: region.id, name: region.name } : null,
	features: { vehicleHistory: network.hasVehiclesFeature },
	lines: lines?.map((line) => ({
		id: line.id,
		number: line.number,
		cartridgeHref: line.cartridgeHref,
		color: { foreground: line.textColor, background: line.color },
		order: line.sortOrder,
	})),
});
