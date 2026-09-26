import DOMPurify from "dompurify";
import { useMemo } from "react";

import { cn } from "~/utils/cn";

/**
 * Le HTML vient des producteurs : seul ce qui sert à mettre en forme un texte est gardé. Les styles
 * en ligne sont retirés, ils se battraient avec le thème.
 */
const purify = DOMPurify();
purify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "A") {
		node.setAttribute("target", "_blank");
		node.setAttribute("rel", "noopener noreferrer");
	}
});

const SANITIZE_OPTIONS = {
	ALLOWED_TAGS: [
		"p",
		"br",
		"ul",
		"ol",
		"li",
		"strong",
		"b",
		"em",
		"i",
		"u",
		"a",
		"img",
		"span",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
	],
	ALLOWED_ATTR: ["href", "src", "alt", "width", "height"],
};

/** Un texte sans balise garde ses retours à la ligne : ils sont sa seule mise en forme. */
const looksLikeHtml = (value: string) => /<[a-z][\s\S]*>/i.test(value);

export function ServiceAlertDescription({ className, html }: Readonly<{ className?: string; html: string }>) {
	const sanitized = useMemo(() => (looksLikeHtml(html) ? purify.sanitize(html, SANITIZE_OPTIONS) : undefined), [html]);

	if (sanitized === undefined) {
		return <p className={cn("whitespace-pre-line", className)}>{html}</p>;
	}

	return (
		<div
			className={cn(
				"space-y-1.5 [&_a]:underline [&_a]:underline-offset-2 [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-bold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
				className,
			)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: assaini par DOMPurify, balises et attributs en liste blanche
			dangerouslySetInnerHTML={{ __html: sanitized }}
		/>
	);
}
