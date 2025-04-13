import clsx from "clsx";
import { Link as RouterLink } from "react-router-dom";

export function Link({ className, ...props }: React.ComponentProps<typeof RouterLink>) {
	return (
		<RouterLink
			{...props}
			className={clsx("transition-colors text-foreground/70 hover:text-foreground/50", className)}
		/>
	);
}
