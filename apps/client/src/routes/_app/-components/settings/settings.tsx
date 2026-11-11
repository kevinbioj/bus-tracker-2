import { SettingsIcon, XIcon } from "lucide-react";

import { SettingSection } from "~/components/setting-blocks";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";
import { DisplayedCountriesSetting } from "~/routes/_app/-components/settings/displayed-countries";
import { EditorTokenInput } from "~/routes/_app/-components/settings/editor-token-input";
import { LanguageSetting } from "~/routes/_app/-components/settings/language-setting";
import { OnlyNetworksWithHistorySetting } from "~/routes/_app/-components/settings/only-networks-with-history";

export function Settings() {
	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button size="icon-lg" variant="on-branding-outline">
						<SettingsIcon aria-label={m.settings_aria_label()} />
					</Button>
				}
			/>
			<DialogContent
				aria-describedby={undefined}
				className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 font-sans sm:max-w-md"
				showCloseButton={false}
			>
				<div className="flex shrink-0 items-center gap-2 border-b py-1.5 pr-1.5 pl-3">
					<SettingsIcon className="size-4 text-muted-foreground" />
					<DialogTitle className="flex-1 text-sm leading-normal font-semibold">{m.settings_title()}</DialogTitle>
					<DialogClose
						render={
							<Button className="size-7" size="icon" title={m.common_close()} variant="ghost">
								<XIcon className="size-4" />
							</Button>
						}
					/>
				</div>
				<div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
					<SettingSection title={m.settings_general_section()}>
						<LanguageSetting />
						<DisplayedCountriesSetting />
					</SettingSection>
					<SettingSection title={m.settings_data_section()}>
						<OnlyNetworksWithHistorySetting />
					</SettingSection>
					<SettingSection title={m.settings_contribution_section()}>
						<EditorTokenInput />
					</SettingSection>
				</div>
			</DialogContent>
		</Dialog>
	);
}
