import { useQuery } from "@tanstack/react-query";
import { LucideCircle, LucideMegaphone } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { GetAnnouncementsQuery } from "~/api/announcements";
import { AnnouncementContent, AnnouncementTitle } from "~/components/announcements/announcement";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { plausible } from "~/utils/plausible";

export function Announcements() {
	const { data: announcements } = useQuery(GetAnnouncementsQuery);
	const [announcementsRead, setAnnouncementsRead] = useLocalStorage<string[]>("announcements-read", []);

	const trackAnnouncementRead = (id: string) => {
		if (announcementsRead.includes(id)) return;

		setAnnouncementsRead([...announcementsRead, id]);
		plausible.trackEvent("announcement-read", {
			props: { id },
		});
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="relative" size="icon" variant="branding-outline">
					<LucideMegaphone aria-label="Actualités" />
					{typeof announcements !== "undefined" && announcements.length > 0 && (
						<span className="absolute animate-in bg-white -top-2 -left-2 size-4 rounded-full text-black text-xs z-10">
							{announcements.length}
						</span>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined} className="">
				<DialogHeader>
					<DialogTitle>Actualités</DialogTitle>
				</DialogHeader>
				<Accordion onValueChange={trackAnnouncementRead} type="single" collapsible>
					{announcements?.map((announcement) => (
						<AccordionItem key={announcement.id} value={announcement.id.toString()}>
							<AccordionTrigger className="relative">
								<AnnouncementTitle announcement={announcement} />
								{!announcementsRead.includes(announcement.id.toString()) && (
									<LucideCircle className="absolute top-2 -left-3 size-2 fill-green-600 stroke-green-600 animate-pulse" />
								)}
							</AccordionTrigger>
							<AccordionContent className="text-black dark:text-white">
								<AnnouncementContent announcement={announcement} />
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</DialogContent>
		</Dialog>
	);
}
