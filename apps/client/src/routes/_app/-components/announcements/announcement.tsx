import dayjs from "dayjs";
import { LucideCloudLightning, LucideInfo } from "lucide-react";

import type { Announcement } from "~/api/announcements";
import * as m from "~/paraglide/messages";

type AnnouncementProps = {
	announcement: Announcement;
};

export function AnnouncementTitle({ announcement }: Readonly<AnnouncementProps>) {
	return (
		<div className="flex gap-2">
			{announcement.type === "INFO" ? (
				<LucideInfo className="inline mr-2 text-blue-500" />
			) : (
				<LucideCloudLightning className="inline mr-2 text-red-500" />
			)}
			<span className="font-bold text-black text-start dark:text-white">{announcement.title}</span>
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
				<p className="text-muted-foreground">{m.announcements_no_details()}</p>
			)}
			{(announcement.publishedAt !== null || announcement.updatedAt !== announcement.createdAt) && (
				<p className="flex justify-end mt-3 text-muted-foreground text-sm">
					{announcement.updatedAt !== announcement.createdAt &&
						m.announcements_updated_at({ date: dayjs(announcement.updatedAt).format("L LT") })}
					{announcement.publishedAt !== null && announcement.updatedAt !== announcement.createdAt && " • "}
					{announcement.publishedAt !== null && dayjs(announcement.publishedAt).format("L LT")}
				</p>
			)}
		</>
	);
}
