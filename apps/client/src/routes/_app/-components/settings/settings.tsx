import { LucideSettings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import * as m from "~/paraglide/messages";
import { DisplayedCountriesSetting } from "~/routes/_app/-components/settings/displayed-countries";
import { EditorTokenInput } from "~/routes/_app/-components/settings/editor-token-input";
import { OnlyNetworksWithHistorySetting } from "~/routes/_app/-components/settings/only-networks-with-history";
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
			<DialogContent
				aria-describedby={undefined}
				className="max-h-[80dvh] sm:max-w-xl overflow-hidden flex flex-col px-0 pb-0"
			>
				<DialogHeader className="px-4">
					<DialogTitle>{m.settings_title()}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto">
					<div className="px-4 pb-4">
						<section>
							<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_general_section()}
							</h3>
							<div className="flex flex-col gap-4">
								<LanguageSetting />
								<DisplayedCountriesSetting />
							</div>
						</section>
						<Separator className="my-3" />
						<section>
							<h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{m.settings_data_section()}
							</h3>
							<div className="flex flex-col gap-4">
								<OnlyNetworksWithHistorySetting />
							</div>
						</section>
						<Separator className="my-3" />
						<EditorTokenInput />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
