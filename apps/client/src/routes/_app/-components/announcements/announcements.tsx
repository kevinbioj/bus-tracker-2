import { useQuery } from "@tanstack/react-query";
import { LucideCircle, LucideMegaphone } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useLocalStorage } from "usehooks-ts";

import { GetAnnouncementsQuery } from "~/api/announcements";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";
import { AnnouncementContent, AnnouncementTitle } from "~/routes/_app/-components/announcements/announcement";

export function Announcements() {
	const { data: announcements } = useQuery(GetAnnouncementsQuery);
	const [announcementsRead, setAnnouncementsRead] = useLocalStorage<number[]>("announcements-read", []);

	const posthog = usePostHog();

	// If we have no announcement, we don't even display the icon.
	if (announcements === undefined) return null;

	const unreadAnnouncementsCount = announcements.reduce(
		(count, { id }) => count + (announcementsRead.includes(id) ? 0 : 1),
		0,
	);

	const trackAnnouncementRead = (value: string) => {
		const id = +value;
		if (announcementsRead.includes(id)) return;

		setAnnouncementsRead([...announcementsRead, id]);
		posthog.capture("announcement-read", { id });
	};

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button className="relative" size="icon-lg" variant="on-branding-outline">
						<LucideMegaphone aria-label={m.announcements_aria_label()} />
						{unreadAnnouncementsCount > 0 && (
							<span className="absolute animate-pulse bg-green-600 -top-2 -left-2 size-4 rounded-full text-white text-xs z-10">
								{unreadAnnouncementsCount}
							</span>
						)}
					</Button>
				}
			/>
			<DialogContent aria-describedby={undefined} className="max-h-[80dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{m.announcements_title()}</DialogTitle>
				</DialogHeader>
				{announcements.length === 0 ? (
					<p className="text-muted-foreground text-center py-8">{m.announcements_empty()}</p>
				) : (
					<Accordion>
						{announcements.map((announcement) => (
							<AccordionItem key={announcement.id} value={announcement.id}>
								<AccordionTrigger className="relative">
									<AnnouncementTitle announcement={announcement} />
									{!announcementsRead.includes(announcement.id) && (
										<LucideCircle className="absolute top-2 -left-3 size-2 fill-green-600 stroke-green-600 animate-pulse" />
									)}
								</AccordionTrigger>
								<AccordionContent className="text-black dark:text-white">
									<AnnouncementContent announcement={announcement} />
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				)}
			</DialogContent>
		</Dialog>
	);
}
