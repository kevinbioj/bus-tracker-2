import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/util/merge";

const buttonVariants = cva(
	"inline-flex items-center justify-center rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none",
	{
		variants: {
			variant: {
				brand: "bg-brand hover:bg-brand-hover text-white",
				inherit: "hover:brightness-90",
			},
			size: {
				default: "h-10 py-2 px-4",
			},
		},
		defaultVariants: {
			variant: "brand",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
