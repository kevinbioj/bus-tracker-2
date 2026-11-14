import { HistoryIcon, ListIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useOnlyNetworksWithHistory } from "~/hooks/use-only-networks-with-history";
import * as m from "~/paraglide/messages";

type NetworksListNoticeProps = {
	icon: LucideIcon;
	children: ReactNode;
	actionLabel: string;
	onAction: () => void;
};

export function NetworksListNotice({ icon: Icon, children, actionLabel, onAction }: Readonly<NetworksListNoticeProps>) {
	return (
		<p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
			<Icon aria-hidden="true" className="mt-px size-3.5 shrink-0 sm:size-4" />
			<span>
				{children}{" "}
				<button
					className="rounded-sm font-medium text-foreground underline underline-offset-2 outline-none hover:text-branding focus-visible:ring-2 focus-visible:ring-branding/50 dark:hover:text-foreground/80"
					onClick={onAction}
					type="button"
				>
					{actionLabel}
				</button>
			</span>
		</p>
	);
}

export function NetworksListHistoryNotice() {
	const [onlyNetworksWithHistory, setOnlyNetworksWithHistory] = useOnlyNetworksWithHistory();

	return onlyNetworksWithHistory ? (
		<NetworksListNotice
			actionLabel={m.networks_list_show_all()}
			icon={HistoryIcon}
			onAction={() => setOnlyNetworksWithHistory(false)}
		>
			{m.networks_list_history_only_notice()}
		</NetworksListNotice>
	) : (
		<NetworksListNotice
			actionLabel={m.networks_list_hide_without_history()}
			icon={ListIcon}
			onAction={() => setOnlyNetworksWithHistory(true)}
		>
			{m.networks_list_all_notice()}
		</NetworksListNotice>
	);
}
