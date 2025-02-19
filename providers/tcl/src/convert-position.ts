import proj4 from "proj4";

proj4.defs(
	"ESRI:102100",
	"+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
);
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");

export type WGS84WebMercatorPosition = {
	X: number;
	Y: number;
};

export function convertPosition({ X, Y }: WGS84WebMercatorPosition) {
	const { x, y } = proj4("ESRI:102100", "EPSG:4326", { x: X, y: Y });
	return { longitude: x, latitude: y };
}
