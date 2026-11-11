import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { useQuery } from "@tanstack/react-query";
import { CheckCheckIcon, MegaphoneIcon, XIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useLocalStorage } from "usehooks-ts";

import { type Announcement, GetAnnouncementsQuery } from "~/api/announcements";
import { SettingSection } from "~/components/setting-blocks";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";
import { AnnouncementItem, getAnnouncementDate } from "~/routes/_app/-components/announcements/announcement";

function groupByMonth(announcements: Announcement[]) {
	const groups = new Map<string, Announcement[]>();
	for (const announcement of announcements.toSorted(
		(a, b) => getAnnouncementDate(b).valueOf() - getAnnouncementDate(a).valueOf(),
	)) {
		const month = getAnnouncementDate(announcement).format("MMMM YYYY");
		groups.set(month, [...(groups.get(month) ?? []), announcement]);
	}
	return [...groups];
}

export function Announcements() {
	const { data: announcements } = useQuery(GetAnnouncementsQuery);
	const [announcementsRead, setAnnouncementsRead] = useLocalStorage<number[]>("announcements-read", []);

	const posthog = usePostHog();

	if (announcements === undefined) return null;

	const unreadAnnouncementsCount = announcements.reduce(
		(count, { id }) => count + (announcementsRead.includes(id) ? 0 : 1),
		0,
	);

	const trackAnnouncementsRead = (ids: number[]) => {
		const newlyRead = ids.filter((id) => !announcementsRead.includes(id));
		if (newlyRead.length === 0) return;

		setAnnouncementsRead([...announcementsRead, ...newlyRead]);
		for (const id of newlyRead) posthog.capture("announcement-read", { id });
	};

	const markAllAsRead = () =>
		setAnnouncementsRead([...new Set([...announcementsRead, ...announcements.map(({ id }) => id)])]);

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button className="relative" size="icon-lg" variant="on-branding-outline">
						<MegaphoneIcon aria-label={m.announcements_aria_label()} />
						{unreadAnnouncementsCount > 0 && (
							<span className="absolute animate-pulse bg-green-600 -top-2 -left-2 size-4 rounded-full text-white text-xs z-10">
								{unreadAnnouncementsCount}
							</span>
						)}
					</Button>
				}
			/>
			<DialogContent
				aria-describedby={undefined}
				className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 font-sans sm:max-w-md"
				showCloseButton={false}
			>
				<div className="flex shrink-0 items-center gap-2 border-b py-1.5 pr-1.5 pl-3">
					<MegaphoneIcon className="size-4 text-muted-foreground" />
					<DialogTitle className="flex-1 text-sm leading-normal font-semibold">{m.announcements_title()}</DialogTitle>
					{unreadAnnouncementsCount > 0 && (
						<Button className="h-7 text-xs text-muted-foreground" size="sm" variant="ghost" onClick={markAllAsRead}>
							<CheckCheckIcon className="size-3.5" />
							{m.announcements_mark_all_read()}
						</Button>
					)}
					<DialogClose
						render={
							<Button className="size-7" size="icon" title={m.common_close()} variant="ghost">
								<XIcon className="size-4" />
							</Button>
						}
					/>
				</div>
				{announcements.length === 0 ? (
					<div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
						<span className="flex size-12 items-center justify-center rounded-full bg-muted">
							<MegaphoneIcon className="size-5 text-muted-foreground" />
						</span>
						<p className="text-sm text-muted-foreground">{m.announcements_empty()}</p>
					</div>
				) : (
					<AccordionPrimitive.Root
						className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3"
						multiple
						onValueChange={(ids) => trackAnnouncementsRead(ids as number[])}
					>
						{groupByMonth(announcements).map(([month, items]) => (
							<SettingSection key={month} title={month}>
								{items.map((announcement) => (
									<AnnouncementItem
										key={announcement.id}
										announcement={announcement}
										unread={!announcementsRead.includes(announcement.id)}
									/>
								))}
							</SettingSection>
						))}
					</AccordionPrimitive.Root>
				)}
			</DialogContent>
		</Dialog>
	);
}
