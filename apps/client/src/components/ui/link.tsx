import { Link as RouterLink } from "react-router-dom";

import { cn } from "~/utils/utils";

export function Link({ className, ...props }: React.ComponentProps<typeof RouterLink>) {
	return (
		<RouterLink {...props} className={cn("transition-colors text-foreground/70 hover:text-foreground/50", className)} />
	);
}
