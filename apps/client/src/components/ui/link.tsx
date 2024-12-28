import clsx from "clsx";
import { type ComponentPropsWithRef, type ForwardedRef, forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";

type LinkProps = ComponentPropsWithRef<typeof RouterLink>;

function _Link({ className, ...props }: LinkProps, ref?: ForwardedRef<HTMLAnchorElement>) {
	return (
		<RouterLink
			{...props}
			className={clsx("transition-colors text-foreground/70 hover:text-foreground/50", className)}
			ref={ref}
		/>
	);
}

export const Link = forwardRef(_Link);
