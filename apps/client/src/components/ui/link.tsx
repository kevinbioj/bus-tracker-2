import { Link as RouterLink } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import { cn } from "~/utils/utils";

type RouterLinkProps = ComponentProps<typeof RouterLink>;

type LinkProps = (RouterLinkProps & { external?: false }) | (ComponentProps<"a"> & { external: true });

export function Link({ className, external, ...props }: LinkProps) {
	const merged = cn("transition-colors text-foreground/70 hover:text-foreground/50", className);
	if (external) {
		const { to, ...rest } = props as ComponentProps<"a"> & { to?: string };
		return <a {...rest} href={to ?? rest.href} className={merged} />;
	}
	return <RouterLink {...(props as RouterLinkProps)} className={merged} />;
}
