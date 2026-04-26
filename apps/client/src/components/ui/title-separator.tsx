import type { ComponentPropsWithoutRef } from "react";

import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";

type TitleSeparatorProps = ComponentPropsWithoutRef<"div">;

export function TitleSeparator({ className, children, ...props }: TitleSeparatorProps) {
	return (
		<div {...props}>
			<div className="flex items-center gap-3">
				<span className={cn("font-semibold whitespace-nowrap text-muted-foreground", className)} {...props}>
					{children}
				</span>
				<Separator className="flex-1" />
			</div>
		</div>
	);
}
