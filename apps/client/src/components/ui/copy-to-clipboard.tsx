import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/utils/utils";

type CopyToClipboardProps = React.ComponentProps<typeof Button> & {
	data: string;
};

export function CopyToClipboard({ className, data, ...props }: CopyToClipboardProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(data);
		setCopied(true);
	};

	return (
		<Button className={cn("ml-0.5 text-xs p-1 h-auto", className)} onClick={handleCopy} variant="ghost" {...props}>
			{copied ? "Copié" : "Copier"}
		</Button>
	);
}
