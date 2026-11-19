import { DownloadIcon, EllipsisVerticalIcon, ShareIcon, SquarePlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";
import { posthog } from "~/utils/posthog";
import { type InstallMethod, promptInstall } from "~/utils/pwa-install";

const inlineIconClasses = "inline size-4 align-text-bottom mx-1";

function Step({ index, children }: Readonly<{ index: number; children: ReactNode }>) {
	return (
		<li className="flex items-start gap-2">
			<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-branding/10 text-xs font-semibold text-branding dark:bg-branding/40 dark:text-branding-foreground">
				{index}
			</span>
			<span className="leading-snug">{children}</span>
		</li>
	);
}

type InstallInstructionsProps = {
	method: InstallMethod;
	onInstalled?: () => void;
};

export function InstallInstructions({ method, onInstalled }: Readonly<InstallInstructionsProps>) {
	if (method === "native") {
		return (
			<Button
				className="self-start"
				size="sm"
				variant="branding-default"
				onClick={async () => {
					const outcome = await promptInstall();
					posthog.capture("pwa_install_prompt", { method, outcome });
					if (outcome === "accepted") onInstalled?.();
				}}
			>
				<DownloadIcon />
				{m.install_button()}
			</Button>
		);
	}

	return (
		<ol className="flex flex-col gap-1.5">
			{method === "ios" ? (
				<>
					<Step index={1}>
						{m.install_ios_step_share_before()}
						<ShareIcon aria-label={m.install_ios_share_label()} className={inlineIconClasses} />
						{m.install_ios_step_share_after()}
					</Step>
					<Step index={2}>
						{m.install_ios_step_add_before()}
						<SquarePlusIcon aria-hidden className={inlineIconClasses} />
						{m.install_ios_step_add_after()}
					</Step>
				</>
			) : (
				<>
					<Step index={1}>
						{m.install_android_step_menu_before()}
						<EllipsisVerticalIcon aria-label={m.install_android_menu_label()} className={inlineIconClasses} />
						{m.install_android_step_menu_after()}
					</Step>
					<Step index={2}>{m.install_android_step_add()}</Step>
				</>
			)}
		</ol>
	);
}
