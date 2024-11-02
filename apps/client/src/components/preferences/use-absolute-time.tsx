"use client";

import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export default function UseAbsoluteTimePreference() {
	const [useAbsoluteTime, setAbsoluteTime] = useLocalStorage("use-absolute-time", false);
	return (
		<div className="flex gap-3 items-center">
			<Switch checked={useAbsoluteTime} id="use-absolute-time-preference" onCheckedChange={setAbsoluteTime} />
			<Label htmlFor="use-absolute-time-preference">
				Afficher l&apos;heure absolue au lieu de l&apos;heure relative
			</Label>
		</div>
	);
}
