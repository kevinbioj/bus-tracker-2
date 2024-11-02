import "leaflet/dist/leaflet.css";
import { InteractiveMap } from "~/components/interactive-map/interactive-map";

export default function MapPage() {
	return <InteractiveMap className="h-[100dvh] w-full" defaultCenter={[49.177814, -0.005493]} defaultZoom={10} />;
}
