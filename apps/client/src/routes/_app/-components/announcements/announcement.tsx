import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { ChevronDownIcon, CloudLightningIcon, InfoIcon } from "lucide-react";

import type { Announcement } from "~/api/announcements";
import { AccordionContent } from "~/components/ui/accordion";
import * as m from "~/paraglide/messages";

export function getAnnouncementDate(announcement: Announcement) {
	return dayjs(announcement.publishedAt ?? announcement.createdAt);
}

const announcementTypes = {
	INFO: {
		icon: InfoIcon,
		label: m.announcements_type_info,
		tileClasses: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
	},
	OUTAGE: {
		icon: CloudLightningIcon,
		label: m.announcements_type_outage,
		tileClasses: "bg-red-500/10 text-red-600 dark:text-red-400",
	},
} as const;

type AnnouncementItemProps = {
	announcement: Announcement;
	unread: boolean;
};

export function AnnouncementItem({ announcement, unread }: Readonly<AnnouncementItemProps>) {
	const { icon: Icon, label, tileClasses } = announcementTypes[announcement.type];
	const date = getAnnouncementDate(announcement);
	const updated = announcement.updatedAt !== announcement.createdAt;

	return (
		<AccordionPrimitive.Item value={announcement.id}>
			<AccordionPrimitive.Header>
				<AccordionPrimitive.Trigger className="group/announcement flex w-full items-start gap-3 p-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted">
					<span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-md", tileClasses)}>
						<Icon className="size-4" />
					</span>
					<span className="grid min-w-0 flex-1 gap-1">
						<span className={clsx("text-sm leading-snug", unread ? "font-semibold" : "font-medium")}>
							{announcement.title}
						</span>
						<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
							<span>{label()}</span>
							<span aria-hidden>·</span>
							<time dateTime={date.toISOString()} title={date.format("L LT")}>
								{date.fromNow()}
							</time>
							{unread && (
								<span className="rounded-full bg-branding px-1.5 py-px text-[10px] font-semibold tracking-wide text-branding-foreground uppercase">
									{m.announcements_new()}
								</span>
							)}
						</span>
					</span>
					<ChevronDownIcon className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded/announcement:rotate-180" />
				</AccordionPrimitive.Trigger>
			</AccordionPrimitive.Header>
			<AccordionContent className="pr-3 pb-3 pl-14 text-foreground [&_a]:text-branding dark:[&_a]:text-branding-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
				{announcement.content ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: content is controlled
					<div dangerouslySetInnerHTML={{ __html: announcement.content }} />
				) : (
					<p className="text-muted-foreground">{m.announcements_no_details()}</p>
				)}
				<p className="mt-3 text-xs text-muted-foreground">
					{m.announcements_published_at({ date: date.format("L LT") })}
					{updated && ` · ${m.announcements_updated_at({ date: dayjs(announcement.updatedAt).format("L LT") })}`}
				</p>
			</AccordionContent>
		</AccordionPrimitive.Item>
	);
}
