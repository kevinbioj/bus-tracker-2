import dayjs from "dayjs";
import { LucideCloudLightning, LucideInfo } from "lucide-react";

import type { Announcement } from "~/api/announcements";

type AnnouncementProps = {
	announcement: Announcement;
};

export function AnnouncementTitle({ announcement }: Readonly<AnnouncementProps>) {
	return (
		<div className="font-bold">
			{announcement.type === "INFO" ? (
				<LucideInfo className="inline mr-2 text-blue-500" />
			) : (
				<LucideCloudLightning className="inline mr-2 text-red-500" />
			)}
			<span className="text-black dark:text-white">{announcement.title}</span>
		</div>
	);
}

export function AnnouncementContent({ announcement }: Readonly<AnnouncementProps>) {
	return (
		<>
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
					{announcement.publishedAt !== null && dayjs(announcement.publishedAt).format("DD/MM/YYYY [à] HH:mm")}
				</p>
			)}
		</>
	);
}
