import { HistoryIcon, ListFilterIcon, ListIcon } from "lucide-react";

import { SettingChoice, settingIconClasses } from "~/components/setting-blocks";
import { useOnlyNetworksWithHistory } from "~/hooks/use-only-networks-with-history";
import * as m from "~/paraglide/messages";

export function OnlyNetworksWithHistorySetting() {
	const [onlyNetworksWithHistory, setOnlyNetworksWithHistory] = useOnlyNetworksWithHistory();

	return (
		<SettingChoice<"all" | "history">
			description={m.settings_only_networks_with_history_description()}
			icon={<ListFilterIcon className={settingIconClasses} />}
			label={m.settings_only_networks_with_history_label()}
			options={[
				{ value: "all", label: m.settings_only_networks_with_history_all(), icon: ListIcon },
				{ value: "history", label: m.settings_only_networks_with_history_history(), icon: HistoryIcon },
			]}
			value={onlyNetworksWithHistory ? "history" : "all"}
			onChange={(value) => setOnlyNetworksWithHistory(value === "history")}
		/>
	);
}
