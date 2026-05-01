import { VehiclesMap } from "~/components/vehicles-map/vehicles-map";

export default function MapPage() {
	return (
		<>
			<title>Carte – Bus Tracker</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<VehiclesMap className="h-[calc(100dvh-56px)]" />
		</>
	);
}
