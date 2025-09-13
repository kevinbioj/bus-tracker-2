import "leaflet/dist/leaflet.css";

import { InteractiveMap } from "~/components/interactive-map/interactive-map";

export default function MapPage() {
	return (
		<>
			<title>Carte – Bus Tracker</title>
			<InteractiveMap className="h-[calc(100vh-60px)] w-full" defaultCenter={[49.177814, -0.005493]} defaultZoom={10} />
		</>
	);
}
