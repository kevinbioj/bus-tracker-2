import type * as React from "react";

import { cn } from "~/utils/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)}
			data-slot="card"
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col space-y-1.5 p-6", className)} data-slot="card-header" {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
			data-slot="card-title"
			{...props}
		/>
	);
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("text-sm text-muted-foreground", className)} data-slot="card-description" {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("p-6 pt-0", className)} data-slot="card-content" {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex items-center p-6 pt-0", className)} data-slot="card-footer" {...props} />;
}
