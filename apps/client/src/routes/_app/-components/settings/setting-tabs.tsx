import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/utils/cn";

// The base list has a fixed height and its triggers never wrap, which overflows on narrow screens
// as soon as a label is a bit long — settings labels usually are, so they get a wrapping variant.

export function SettingTabsList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
	// `h-auto!` is needed because the base height is set behind a `group-data-[orientation]` variant,
	// which outweighs a plain `h-auto` in specificity.
	return <TabsList className={cn("grid h-auto! w-full", className)} {...props} />;
}

export function SettingTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
	return (
		<TabsTrigger
			className={cn(
				"min-w-0 py-1.5 text-center text-xs leading-tight text-balance whitespace-normal wrap-break-words sm:text-sm",
				className,
			)}
			{...props}
		/>
	);
}
