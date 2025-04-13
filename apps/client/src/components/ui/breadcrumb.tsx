import { Slot } from "@radix-ui/react-slot";
import { ChevronRight } from "lucide-react";
import type * as React from "react";

import { cn } from "~/utils/utils";

export function Breadcrumb(props: React.ComponentProps<"nav">) {
	return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn(
				"flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
				className,
			)}
			data-slot="breadcrumb-list"
			{...props}
		/>
	);
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return <li className={cn("inline-flex items-center gap-1.5", className)} data-slot="breadcrumb-item" {...props} />;
}

export function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "a";
	return (
		<Comp className={cn("transition-colors hover:text-foreground", className)} data-slot="breadcrumb-link" {...props} />
	);
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			aria-current="page"
			aria-disabled="true"
			className={cn("font-normal text-foreground", className)}
			data-slot="breadcrumb-page"
			{...props}
		/>
	);
}

export function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			aria-hidden="true"
			className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
			data-slot="breadcrumb-separator"
			role="presentation"
			{...props}
		>
			{children ?? <ChevronRight />}
		</li>
	);
}
