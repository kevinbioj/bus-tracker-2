import dayjs from "dayjs";
import { ClockIcon, SettingsIcon, TimerIcon, XIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { SettingChoice } from "~/components/setting-blocks";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { formatCountdown } from "~/components/vehicles-map/call-time-format";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import * as m from "~/paraglide/messages";

/** Minutes d'attente du passage pris en exemple pour illustrer les deux modes d'affichage. */
const EXAMPLE_WAIT_MINUTES = 5;

export function NextCallsDisplayModeChoice({ icon }: Readonly<{ icon?: ReactNode }>) {
	const [displayMode, setDisplayMode] = useNextCallsDisplayMode();

	return (
		<SettingChoice<NextCallsDisplayMode>
			icon={icon}
			label={m.settings_next_calls_display_label()}
			options={[
				{
					value: "absolute",
					label: m.settings_next_calls_display_absolute(),
					icon: ClockIcon,
					example: dayjs().add(EXAMPLE_WAIT_MINUTES, "minutes").format("HH:mm"),
				},
				{
					value: "relative",
					label: m.settings_next_calls_display_relative(),
					icon: TimerIcon,
					example: formatCountdown(EXAMPLE_WAIT_MINUTES),
				},
			]}
			value={displayMode}
			onChange={setDisplayMode}
		/>
	);
}

export function SettingsPopoverControl({ children }: Readonly<{ children: ReactNode }>) {
	const map = useMap();
	const [controlRef, setControlRef] = useState<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setControlRef(document.createElement("div"));
	}, []);

	useEffect(() => {
		if (controlRef === null) return;

		controlRef.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group", "map-default-control");

		const control: IControl = {
			onAdd: () => controlRef,
			onRemove: () => controlRef.remove(),
		};

		map.addControl(control, "top-right");
		controlRef.parentElement?.prepend(controlRef);
		return () => {
			map.removeControl(control);
		};
	}, [controlRef, map]);

	return (
		controlRef !== null &&
		createPortal(
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<button className="text-card-foreground" title={m.settings_map_title()} type="button">
							<SettingsIcon className="m-auto p-0.5" strokeWidth={2.5} />
						</button>
					}
				/>
				<PopoverContent
					align="start"
					className="max-h-(--available-height) w-84 max-w-(--available-width) gap-0 overflow-hidden p-0 font-sans"
					collisionAvoidance={{ side: "none", align: "none" }}
					side="left"
					sideOffset={8}
				>
					<div className="flex shrink-0 items-center gap-2 border-b py-1.5 pr-1.5 pl-3">
						<SettingsIcon className="size-4 text-muted-foreground" />
						<PopoverTitle className="flex-1 text-sm font-semibold">{m.settings_map_title()}</PopoverTitle>
						<Button
							className="size-7"
							size="icon"
							title={m.stop_departures_close()}
							variant="ghost"
							onClick={() => setOpen(false)}
						>
							<XIcon className="size-4" />
						</Button>
					</div>
					<div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">{children}</div>
				</PopoverContent>
			</Popover>,
			controlRef,
		)
	);
}
