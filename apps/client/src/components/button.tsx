import { clsx } from "clsx";
import { type ComponentPropsWithRef, type ElementType, type ForwardedRef, forwardRef } from "react";
import { twMerge } from "tw-merge";

type ButtonProps<T extends ElementType = "button"> = { as?: T } & ComponentPropsWithRef<T>;

function _Button<T extends ElementType>(
	{ as = "button", className, ...props }: ButtonProps<T>,
	forwardedRef?: ForwardedRef<T>,
) {
	const Component = as;
	return <Component className={twMerge(clsx(className, "w-full"))} ref={forwardedRef} {...props} />;
}

export const Button = forwardRef(_Button);
