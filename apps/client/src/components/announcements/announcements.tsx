import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { LucideCloudLightning, LucideInfo, LucideMegaphone } from "lucide-react";

import { GetAnnouncementsQuery } from "~/api/announcements";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";

export function Announcements() {
	const { data: announcements } = useQuery(GetAnnouncementsQuery);

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
				<DialogDescription>
					<Accordion type="single" collapsible>
						{announcements?.map((announcement) => (
							<AccordionItem key={announcement.id} value={announcement.id.toString()}>
								<AccordionTrigger>
									<div className="font-bold">
										{announcement.type === "INFO" ? (
											<LucideInfo className="inline mr-2 text-blue-500" />
										) : (
											<LucideCloudLightning className="inline mr-2 text-red-500" />
										)}
										<span className="text-black dark:text-white">{announcement.title}</span>
									</div>
								</AccordionTrigger>
								<AccordionContent className="text-black dark:text-white">
									{announcement.content ? (
										// biome-ignore lint/security/noDangerouslySetInnerHtml: content is controlled
										<div dangerouslySetInnerHTML={{ __html: announcement.content }} />
									) : (
										<p className="text-muted-foreground">Cette actualité ne contient pas de détails.</p>
									)}
									{(announcement.publishedAt !== null || announcement.updatedAt !== announcement.createdAt) && (
										<p className="flex justify-end mt-3 text-muted-foreground text-sm">
											{announcement.updatedAt !== announcement.createdAt && (
												<>Mise à jour le {dayjs(announcement.updatedAt).format("DD/MM/YYYY [à] HH:mm")}</>
											)}
											{announcement.publishedAt !== null && announcement.updatedAt !== announcement.createdAt && " • "}
											{announcement.publishedAt !== null &&
												dayjs(announcement.publishedAt).format("DD/MM/YYYY [à] HH:mm")}
										</p>
									)}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</DialogDescription>
			</DialogContent>
		</Dialog>
	);
}
