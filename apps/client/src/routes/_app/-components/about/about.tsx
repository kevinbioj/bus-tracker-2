import { Link as RouterLink } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
	ArrowUpRightIcon,
	ChevronRightIcon,
	DatabaseIcon,
	GlobeIcon,
	InfoIcon,
	MailIcon,
	ScaleIcon,
	XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { SettingLabel, SettingSection, settingIconClasses } from "~/components/setting-blocks";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { DiscordLogo, GithubLogo, LinkedinLogo } from "~/icons/brand-logos";
import * as m from "~/paraglide/messages";

const buildHash = import.meta.env.VITE_BUILD_HASH ?? "dev";

const builtAt = dayjs(import.meta.env.VITE_BUILD_TIMESTAMP);

const rowClasses = "flex items-center gap-3 p-3 transition-colors outline-none hover:bg-muted focus-visible:bg-muted";

type RowContentProps = {
	icon: ReactNode;
	label: string;
	description?: string;
	trailingIcon: ReactNode;
};

function RowContent({ icon, label, description, trailingIcon }: Readonly<RowContentProps>) {
	return (
		<>
			<span className="min-w-0 flex-1">
				<SettingLabel description={description} icon={icon} label={label} />
			</span>
			{trailingIcon}
		</>
	);
}

const trailingIconClasses = "size-4 shrink-0 text-muted-foreground";

function InternalLinkRow({ to, ...content }: Readonly<Omit<RowContentProps, "trailingIcon"> & { to: string }>) {
	return (
		<DialogClose
			nativeButton={false}
			render={
				<RouterLink className={rowClasses} to={to}>
					<RowContent {...content} trailingIcon={<ChevronRightIcon className={trailingIconClasses} />} />
				</RouterLink>
			}
		/>
	);
}

function ExternalLinkRow({ href, ...content }: Readonly<Omit<RowContentProps, "trailingIcon"> & { href: string }>) {
	return (
		<a className={rowClasses} href={href} rel="noopener" target="_blank">
			<RowContent {...content} trailingIcon={<ArrowUpRightIcon className={trailingIconClasses} />} />
		</a>
	);
}

export function About() {
	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button size="icon-lg" variant="on-branding-outline">
						<InfoIcon aria-label={m.about_aria_label()} />
					</Button>
				}
			/>
			<DialogContent
				aria-describedby={undefined}
				className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 font-sans sm:max-w-md"
				showCloseButton={false}
			>
				<div className="flex shrink-0 items-center gap-2 border-b py-1.5 pr-1.5 pl-3">
					<InfoIcon className="size-4 text-muted-foreground" />
					<DialogTitle className="flex-1 text-sm leading-normal font-semibold">{m.about_title()}</DialogTitle>
					<DialogClose
						render={
							<Button className="size-7" size="icon" title={m.common_close()} variant="ghost">
								<XIcon className="size-4" />
							</Button>
						}
					/>
				</div>
				<div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
					<div className="flex items-center gap-4 rounded-lg bg-branding/5 p-4 ring-1 ring-branding/15 dark:bg-branding/15 dark:ring-branding/30">
						<img alt="" className="size-14 shrink-0 drop-shadow-md" src="/logo.svg" />
						<div className="grid min-w-0 gap-1">
							<span className="text-lg leading-none font-bold">Bus Tracker</span>
							<span className="text-xs text-muted-foreground">
								{m.about_build({ buildHash, builtAt: builtAt.format("LLLL") })}
							</span>
						</div>
					</div>
					<SettingSection title={m.about_resources_section()}>
						<InternalLinkRow
							icon={<DatabaseIcon className={settingIconClasses} />}
							label={m.about_attributions()}
							to="/attributions"
						/>
						<InternalLinkRow icon={<ScaleIcon className={settingIconClasses} />} label={m.about_legal()} to="/legal" />
					</SettingSection>
					<SettingSection title={m.about_links_section()}>
						<ExternalLinkRow
							description="kevinbioj/bus-tracker-2"
							href="https://github.com/kevinbioj/bus-tracker-2"
							icon={<GithubLogo className="size-5 shrink-0" />}
							label="GitHub"
						/>
						<ExternalLinkRow
							href="https://discord.gg/DpwtEU4qBg"
							icon={<DiscordLogo className="size-5 shrink-0 text-[#5865F2]" />}
							label="Discord"
						/>
					</SettingSection>
					<SettingSection title={m.about_contact_section()}>
						<a className={rowClasses} href="mailto:contact@bus-tracker.fr">
							<RowContent
								description={`${m.about_contact_email()} contact@bus-tracker.fr`}
								icon={<MailIcon className={settingIconClasses} />}
								label={m.about_contact()}
								trailingIcon={<ArrowUpRightIcon className={trailingIconClasses} />}
							/>
						</a>
						<ExternalLinkRow
							href="https://kevinbioj.fr"
							icon={<GlobeIcon className={settingIconClasses} />}
							label="kevinbioj.fr"
						/>
						<ExternalLinkRow
							href="https://www.linkedin.com/in/kevinbioj/"
							icon={<LinkedinLogo className="size-5 shrink-0 text-[#0A66C2]" />}
							label="LinkedIn"
						/>
					</SettingSection>
					<p className="text-center text-xs text-muted-foreground">Bus Tracker · 2023–2026</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
