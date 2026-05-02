import { type ComponentProps, useState } from "react";

import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

import { Button } from "./ui/button";

export function CopyToClipboard({
	className,
	data,
	...props
}: ComponentProps<typeof Button> & {
	data: string;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(data);
		setCopied(true);
	};

	return (
		<Button className={cn("ml-0.5 text-xs p-1 h-auto", className)} onClick={handleCopy} variant="ghost" {...props}>
			{copied ? m.common_copied() : m.common_copy()}
		</Button>
	);
}
