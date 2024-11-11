import { LucideSettings } from "lucide-react";

import { DisplayNextCallsSetting } from "~/components/settings/display-next-calls";
import { GeolocateOnStartSetting } from "~/components/settings/geolocate-on-start";
import { DisplayAbsoluteTimeSetting } from "~/components/settings/use-absolute-time";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export function Settings() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="branding-outline">
					<LucideSettings />
					<span className="hidden lg:block">Paramètres</span>
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Paramètres de l'application</DialogTitle>
				</DialogHeader>
				<div className="mt-3 flex flex-col gap-4">
					<GeolocateOnStartSetting />
					<DisplayNextCallsSetting />
					<DisplayAbsoluteTimeSetting />
				</div>
			</DialogContent>
		</Dialog>
	);
}
