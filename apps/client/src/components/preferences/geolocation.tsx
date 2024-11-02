"use client";

import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export default function GeolocationPreference() {
	const [geolocation, setGeolocation] = useLocalStorage("geolocation", false);
	return (
		<div className="flex gap-3 items-center">
			<Switch checked={geolocation} id="geolocation-preference" onCheckedChange={setGeolocation} />
			<Label htmlFor="geolocation-preference">Géolocalisation à l&apos;ouverture</Label>
		</div>
	);
}
