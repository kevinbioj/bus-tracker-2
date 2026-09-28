import type { ComponentProps, ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

type TapTooltipProps = {
	/** Élément déclencheur : un bouton, pour être atteignable au doigt comme au clavier. */
	render: ComponentProps<typeof PopoverTrigger>["render"];
	content: ReactNode;
	side?: ComponentProps<typeof PopoverContent>["side"];
};

/**
 * Info-bulle qui s'ouvre au survol, mais aussi au toucher : une info-bulle ordinaire ne réagit pas
 * au doigt, et l'information qu'elle porte resterait hors de portée sur mobile.
 */
export function TapTooltip({ render, content, side = "top" }: Readonly<TapTooltipProps>) {
	return (
		<Popover>
			<PopoverTrigger closeDelay={0} delay={300} openOnHover render={render} />
			<PopoverContent className="w-fit gap-0 px-2.5 py-1.5 shadow-xl" side={side} sideOffset={4}>
				{content}
			</PopoverContent>
		</Popover>
	);
}
