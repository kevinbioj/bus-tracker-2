import { LucideSettings } from "lucide-react";

import { BypassMinZoomSetting } from "~/components/settings/bypass-min-zoom";
import { DisplayNextCallsSetting } from "~/components/settings/display-next-calls";
import { GeolocateOnStartSetting } from "~/components/settings/geolocate-on-start";
import { HideScheduledTripsSetting } from "~/components/settings/hide-scheduled-trips";
import { DisplayAbsoluteTimeSetting } from "~/components/settings/use-absolute-time";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export function Settings() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="on-branding-outline">
					<LucideSettings aria-label="Paramètres" />
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>Paramètres de l'application</DialogTitle>
				</DialogHeader>
				<div className="mt-3 flex flex-col gap-4">
					<GeolocateOnStartSetting />
					<DisplayNextCallsSetting />
					<HideScheduledTripsSetting />
					<DisplayAbsoluteTimeSetting />
					<BypassMinZoomSetting />
				</div>
			</DialogContent>
		</Dialog>
	);
}
