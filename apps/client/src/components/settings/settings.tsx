import { LucideSettings } from "lucide-react";

import { DisplayNextCallsSetting } from "~/components/settings/display-next-calls";
import { EditorTokenInput } from "~/components/settings/editor-token-input";
import { HideScheduledTripsSetting } from "~/components/settings/hide-scheduled-trips";
import { PreviewVehicleNumberSetting } from "~/components/settings/preview-vehicle-number";
import { ShowDebugInfoSetting } from "~/components/settings/show-debug-info";
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
					{/* <GeolocateOnStartSetting /> */}
					<DisplayNextCallsSetting />
					<PreviewVehicleNumberSetting />
					<HideScheduledTripsSetting />
					<DisplayAbsoluteTimeSetting />
					{/* <BypassMinZoomSetting /> */}
					<ShowDebugInfoSetting />
				</div>
				<hr />
				<EditorTokenInput />
			</DialogContent>
		</Dialog>
	);
}
