import { siteUrl } from "../../options.js";

export const networkUrl = (networkId: number) => `${siteUrl}/data/networks/${networkId}`;
export const lineUrl = (lineId: number) => `${siteUrl}/data/lines/${lineId}`;
export const vehicleUrl = (vehicleId: number) => `${siteUrl}/data/vehicles/${vehicleId}`;
