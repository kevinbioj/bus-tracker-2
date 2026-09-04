import { ExternalLinkIcon } from "lucide-react";

import { Link } from "~/components/ui/link";
import { cn } from "~/utils/cn";

type FeedLinkProps = {
	className?: string;
	href: string;
};

/** Nom d'hôte du flux : une URL de flux complète est illisible dans une liste. */
function getFeedLabel(href: string) {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}

/**
 * Lien vers un flux de données. Les URLs ont été expurgées de leurs secrets par le provider avant
 * publication : elles peuvent être affichées et suivies telles quelles.
 */
export function FeedLink({ className, href }: Readonly<FeedLinkProps>) {
	return (
		<Link
			className={cn("inline-flex items-center gap-1 underline decoration-dotted underline-offset-2", className)}
			external
			href={href}
			rel="noreferrer"
			target="_blank"
			title={href}
		>
			{getFeedLabel(href)}
			<ExternalLinkIcon aria-hidden className="size-3 shrink-0" />
		</Link>
	);
}
