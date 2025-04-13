import * as LabelPrimitive from "@radix-ui/react-label";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/utils/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

export function Label({
	ref,
	className,
	...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
	return <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />;
}
