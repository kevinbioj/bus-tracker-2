import { LucideSettings } from "lucide-react";

import { DisplayNextCallsSetting } from "~/routes/_app/-components/settings/display-next-calls";
import { EditorTokenInput } from "~/routes/_app/-components/settings/editor-token-input";
import { HideScheduledTripsSetting } from "~/routes/_app/-components/settings/hide-scheduled-trips";
import { LanguageSetting } from "~/routes/_app/-components/settings/language-setting";
import { OnlyNetworksWithHistorySetting } from "~/routes/_app/-components/settings/only-networks-with-history";
import { PreviewVehicleNumberSetting } from "~/routes/_app/-components/settings/preview-vehicle-number";
import { ShowDebugInfoSetting } from "~/routes/_app/-components/settings/show-debug-info";
import { ShowIdentifiedVehiclesPanelSetting } from "~/routes/_app/-components/settings/show-identified-vehicles-panel";
import { ShowVehiclePathsSetting } from "~/routes/_app/-components/settings/show-vehicle-paths";
import { StopLabelsStyleSetting } from "~/routes/_app/-components/settings/stop-labels-style";
import { DisplayAbsoluteTimeSetting } from "~/routes/_app/-components/settings/use-absolute-time";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import * as m from "~/paraglide/messages";

export function Settings() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="icon" variant="on-branding-outline">
					<LucideSettings aria-label={m.settings_aria_label()} />
				</Button>
			</DialogTrigger>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-xl max-h-[95dvh] flex flex-col gap-0 p-0 overflow-hidden"
			>
				<DialogHeader className="p-6 pb-4">
					<DialogTitle>{m.settings_title()}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-6 pt-0">
					<div className="flex flex-col gap-6">
						<section className="space-y-4 pt-4">
							<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_general_section()}
							</h3>
							<LanguageSetting />
						</section>

						<Separator />

						<section className="space-y-4">
							<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_map_section()}
							</h3>
							<HideScheduledTripsSetting />
							<PreviewVehicleNumberSetting />
							<DisplayNextCallsSetting />
							<ShowVehiclePathsSetting />
							<ShowIdentifiedVehiclesPanelSetting />
							<DisplayAbsoluteTimeSetting />
							<StopLabelsStyleSetting />
						</section>

						<Separator />

						<section className="space-y-4">
							<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_data_section()}
							</h3>
							<OnlyNetworksWithHistorySetting />
						</section>

						<Separator />

						<section className="space-y-4">
							<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_expert_section()}
							</h3>
							<ShowDebugInfoSetting />
						</section>

						<Separator />

						<EditorTokenInput />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
