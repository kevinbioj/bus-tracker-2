import { LucideSettings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import * as m from "~/paraglide/messages";
import { DisplayNextCallsSetting } from "~/routes/_app/-components/settings/display-next-calls";
import { DisplayedVehiclesSetting } from "~/routes/_app/-components/settings/displayed-vehicles";
import { EditorTokenInput } from "~/routes/_app/-components/settings/editor-token-input";
import { OnlyNetworksWithHistorySetting } from "~/routes/_app/-components/settings/only-networks-with-history";
import { PreviewVehicleNumberSetting } from "~/routes/_app/-components/settings/preview-vehicle-number";
import { ShowDebugInfoSetting } from "~/routes/_app/-components/settings/show-debug-info";
import { ShowIdentifiedVehiclesPanelSetting } from "~/routes/_app/-components/settings/show-identified-vehicles-panel";
import { ShowVehiclePathsSetting } from "~/routes/_app/-components/settings/show-vehicle-paths";
import { StopLabelsStyleSetting } from "~/routes/_app/-components/settings/stop-labels-style";
import { DisplayAbsoluteTimeSetting } from "~/routes/_app/-components/settings/use-absolute-time";
import { LanguageSetting } from "./language-setting";

export function Settings() {
	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button size="icon-lg" variant="on-branding-outline">
						<LucideSettings aria-label={m.settings_aria_label()} />
					</Button>
				}
			/>
			<DialogContent aria-describedby={undefined} className="max-h-[80dvh] sm:max-w-xl overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle>{m.settings_title()}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-1">
					<section>
						<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{m.settings_general_section()}
						</h3>
						<LanguageSetting />
					</section>
					<Separator className="my-3" />
					<section>
						<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{m.settings_map_section()}
						</h3>
						<div className="flex flex-col gap-2">
							<DisplayedVehiclesSetting />
							<PreviewVehicleNumberSetting />
							<DisplayNextCallsSetting />
							<ShowIdentifiedVehiclesPanelSetting />
							<DisplayAbsoluteTimeSetting />
							<ShowVehiclePathsSetting />
							<StopLabelsStyleSetting />
						</div>
					</section>
					<Separator className="my-3" />
					<section>
						<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{m.settings_data_section()}
						</h3>
						<OnlyNetworksWithHistorySetting />
					</section>
					<Separator className="my-3" />
					<section>
						<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							{m.settings_expert_section()}
						</h3>
						<ShowDebugInfoSetting />
					</section>
					<Separator className="my-3" />
					<EditorTokenInput />
				</div>
			</DialogContent>
		</Dialog>
	);
}
