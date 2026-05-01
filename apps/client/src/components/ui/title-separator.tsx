import type { ComponentPropsWithoutRef, ElementType } from "react";

import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/cn";

type TitleSeparatorProps = ComponentPropsWithoutRef<"div"> & {
	TitleComponent?: ElementType;
};

export function TitleSeparator({ className, children, TitleComponent = "span", ...props }: TitleSeparatorProps) {
	return (
		<div {...props}>
			<div className="flex items-center gap-3">
				<TitleComponent className={cn("font-semibold whitespace-nowrap text-muted-foreground", className)} {...props}>
					{children}
				</TitleComponent>
				<Separator className="flex-1" />
			</div>
		</div>
	);
}
