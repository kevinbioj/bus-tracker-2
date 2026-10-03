import { clsx } from "clsx";
import dayjs from "dayjs";
import { ClockIcon, SettingsIcon, TimerIcon, XIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { type ReactNode, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { useShowBikesAllowed, useShowWheelchairAccessibility } from "~/components/vehicles-map/accessibility-display";
import { formatCountdown } from "~/components/vehicles-map/call-time-format";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { BikesAllowedIcon } from "~/icons/bikes-allowed";
import { WheelchairIcon } from "~/icons/wheelchair";
import * as m from "~/paraglide/messages";

/** Minutes d'attente du passage pris en exemple pour illustrer les deux modes d'affichage. */
const EXAMPLE_WAIT_MINUTES = 5;

const sectionTitleClasses = "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
	return <h3 className={sectionTitleClasses}>{children}</h3>;
}

type DisplayModeOptionProps = {
	mode: NextCallsDisplayMode;
	selected: boolean;
	onSelect: (mode: NextCallsDisplayMode) => void;
};

/** Un mode d'affichage, illustré par l'heure que prendrait un passage dans quelques minutes. */
function DisplayModeOption({ mode, selected, onSelect }: Readonly<DisplayModeOptionProps>) {
	const Icon = mode === "absolute" ? ClockIcon : TimerIcon;
	const example =
		mode === "absolute"
			? dayjs().add(EXAMPLE_WAIT_MINUTES, "minutes").format("HH:mm")
			: formatCountdown(EXAMPLE_WAIT_MINUTES);

	return (
		<button
			aria-pressed={selected}
			className={clsx(
				"flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				selected
					? "border-branding bg-branding/10 text-foreground"
					: "border-border text-muted-foreground hover:bg-muted",
			)}
			type="button"
			onClick={() => onSelect(mode)}
		>
			<span className="flex items-center gap-1 text-base font-bold tabular-nums">
				<Icon className="size-3.5" />
				{example}
			</span>
			<span className="text-xs leading-tight">
				{mode === "absolute" ? m.settings_next_calls_display_absolute() : m.settings_next_calls_display_relative()}
			</span>
		</button>
	);
}

type SettingToggleProps = {
	icon: ReactNode;
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

/**
 * Réglage à bascule. Le libellé, qui occupe presque toute la ligne, bascule le réglage comme
 * l'interrupteur. Celui-ci reste hors du libellé : imbriqué, un clic le basculerait deux fois.
 */
function SettingToggle({ icon, label, checked, onCheckedChange }: Readonly<SettingToggleProps>) {
	const switchId = useId();

	return (
		<div className="flex items-center gap-3 pr-3 transition-colors hover:bg-muted">
			<label className="flex flex-1 cursor-pointer items-center gap-3 py-2 pl-3" htmlFor={switchId}>
				{icon}
				<span className="text-sm leading-snug">{label}</span>
			</label>
			<Switch checked={checked} id={switchId} onCheckedChange={(checked) => onCheckedChange(checked)} />
		</div>
	);
}

/**
 * Réglages d'affichage de la carte embarquée, à portée de main sur la carte. Ils sont propres à la
 * carte (cf. `EmbedDisplaySettingsProvider`) : les préférences de l'application n'en sont pas changées.
 */
function EmbedSettingsContent({ onClose }: Readonly<{ onClose: () => void }>) {
	const [displayMode, setDisplayMode] = useNextCallsDisplayMode();
	const [showWheelchairAccessibility, setShowWheelchairAccessibility] = useShowWheelchairAccessibility();
	const [showBikesAllowed, setShowBikesAllowed] = useShowBikesAllowed();

	return (
		<>
			<div className="flex items-center gap-2 border-b py-1.5 pr-1.5 pl-3">
				<SettingsIcon className="size-4 text-muted-foreground" />
				<PopoverTitle className="flex-1 text-sm font-semibold">{m.settings_aria_label()}</PopoverTitle>
				<Button className="size-7" size="icon" title={m.stop_departures_close()} variant="ghost" onClick={onClose}>
					<XIcon className="size-4" />
				</Button>
			</div>
			<div className="flex flex-col gap-4 p-3">
				{/* La légende titre le groupe de boutons ; la grille est à l'intérieur, une légende n'y prenant pas place. */}
				<fieldset className="min-w-0">
					<legend className={sectionTitleClasses}>{m.settings_next_calls_display_label()}</legend>
					<div className="grid grid-cols-2 gap-2">
						<DisplayModeOption mode="absolute" selected={displayMode === "absolute"} onSelect={setDisplayMode} />
						<DisplayModeOption mode="relative" selected={displayMode === "relative"} onSelect={setDisplayMode} />
					</div>
				</fieldset>
				<section>
					<SectionTitle>{m.settings_accessibility_section()}</SectionTitle>
					<div className="divide-y overflow-hidden rounded-md border">
						<SettingToggle
							checked={showWheelchairAccessibility}
							icon={<WheelchairIcon className="size-5 shrink-0" status="accessible" />}
							label={m.settings_show_wheelchair_accessibility_label()}
							onCheckedChange={setShowWheelchairAccessibility}
						/>
						<SettingToggle
							checked={showBikesAllowed}
							icon={<BikesAllowedIcon className="size-5 shrink-0" status="allowed" />}
							label={m.settings_show_bikes_allowed_label()}
							onCheckedChange={setShowBikesAllowed}
						/>
					</div>
				</section>
			</div>
		</>
	);
}

export function EmbedSettingsControl() {
	const map = useMap();
	const [controlRef, setControlRef] = useState<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setControlRef(document.createElement("div"));
	}, []);

	useEffect(() => {
		if (controlRef === null) return;

		controlRef.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

		const control: IControl = {
			onAdd: () => controlRef,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-right");
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
						<button className="text-black" title={m.settings_aria_label()} type="button">
							<SettingsIcon className="m-auto p-0.5" strokeWidth={2.5} />
						</button>
					}
				/>
				<PopoverContent
					align="end"
					className="w-80 max-w-[calc(100dvw-20px)] gap-0 overflow-hidden p-0 font-sans"
					sideOffset={8}
				>
					<EmbedSettingsContent onClose={() => setOpen(false)} />
				</PopoverContent>
			</Popover>,
			controlRef,
		)
	);
}
