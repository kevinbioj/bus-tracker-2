import * as SwitchPrimitives from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "~/utils/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
	return (
		<SwitchPrimitives.Root
			className={cn(
				"peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-branding data-[state=unchecked]:bg-input",
				className,
			)}
			data-slot="switch"
			{...props}
		>
			<SwitchPrimitives.Thumb
				className={cn(
					"pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
				)}
			/>
		</SwitchPrimitives.Root>
	);
}
