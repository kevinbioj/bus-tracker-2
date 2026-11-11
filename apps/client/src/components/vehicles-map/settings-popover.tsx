import { clsx } from "clsx";
import dayjs from "dayjs";
import { ClockIcon, type LucideIcon, SettingsIcon, TimerIcon, XIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { type ReactNode, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { formatCountdown } from "~/components/vehicles-map/call-time-format";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import * as m from "~/paraglide/messages";

export const settingIconClasses = "size-5 shrink-0 text-muted-foreground";

export const settingOptionClasses =
	"flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function settingOptionStateClasses(selected: boolean) {
	return selected
		? "border-branding bg-branding/10 text-foreground"
		: "border-border text-muted-foreground hover:bg-muted";
}

export function SettingSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
	return (
		<section>
			<h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
			<div className="divide-y overflow-hidden rounded-lg border">{children}</div>
		</section>
	);
}

function SettingLabel({
	icon,
	label,
	description,
}: Readonly<{ icon?: ReactNode; label: string; description?: string }>) {
	return (
		<span className="flex items-center gap-3">
			{icon}
			<span className="grid gap-0.5">
				<span className="text-sm leading-snug">{label}</span>
				{description !== undefined && <span className="text-xs leading-snug text-muted-foreground">{description}</span>}
			</span>
		</span>
	);
}

function SettingNested({ children }: Readonly<{ children: ReactNode }>) {
	return <div className="border-t border-dashed bg-muted/40 pl-8">{children}</div>;
}

type SettingFieldProps = {
	icon?: ReactNode;
	label: string;
	description?: string;
	children: ReactNode;
	nested?: ReactNode;
};

export function SettingField({ icon, label, description, children, nested }: Readonly<SettingFieldProps>) {
	return (
		<div>
			<fieldset className="min-w-0 p-3">
				{icon !== undefined ? (
					<legend className="float-left mb-2 w-full">
						<SettingLabel description={description} icon={icon} label={label} />
					</legend>
				) : (
					<legend className="float-left mb-1.5 w-full text-xs font-medium text-muted-foreground">{label}</legend>
				)}
				<div className="clear-both">{children}</div>
			</fieldset>
			{nested ? <SettingNested>{nested}</SettingNested> : null}
		</div>
	);
}

export type SettingChoiceOption<T extends string> = {
	value: T;
	label: string;
	icon?: LucideIcon;
	example?: string;
};

type SettingChoiceProps<T extends string> = Omit<SettingFieldProps, "children"> & {
	value: T;
	options: readonly SettingChoiceOption<T>[];
	onChange: (value: T) => void;
};

export function SettingChoice<T extends string>({
	value,
	options,
	onChange,
	...field
}: Readonly<SettingChoiceProps<T>>) {
	return (
		<SettingField {...field}>
			<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
				{options.map(({ value: optionValue, label, icon: Icon, example }) => (
					<button
						key={optionValue}
						aria-pressed={value === optionValue}
						className={clsx(settingOptionClasses, settingOptionStateClasses(value === optionValue))}
						type="button"
						onClick={() => onChange(optionValue)}
					>
						{example !== undefined ? (
							<>
								<span className="flex items-center gap-1 text-base font-bold tabular-nums">
									{Icon !== undefined && <Icon className="size-3.5" />}
									{example}
								</span>
								<span className="text-xs leading-tight">{label}</span>
							</>
						) : (
							<>
								{Icon !== undefined && <Icon className="size-4" />}
								<span className="text-xs leading-tight text-balance">{label}</span>
							</>
						)}
					</button>
				))}
			</div>
		</SettingField>
	);
}

type SettingToggleProps = {
	icon: ReactNode;
	label: string;
	description?: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	nested?: ReactNode;
};

/**
 * Réglage à bascule. Le libellé, qui occupe presque toute la ligne, bascule le réglage comme
 * l'interrupteur. Celui-ci reste hors du libellé : imbriqué, un clic le basculerait deux fois.
 */
export function SettingToggle({
	icon,
	label,
	description,
	checked,
	onCheckedChange,
	nested,
}: Readonly<SettingToggleProps>) {
	const switchId = useId();

	return (
		<div>
			<div className="flex items-center gap-3 pr-3 transition-colors hover:bg-muted">
				<label className="flex-1 cursor-pointer py-2.5 pl-3" htmlFor={switchId}>
					<SettingLabel description={description} icon={icon} label={label} />
				</label>
				<Switch checked={checked} id={switchId} onCheckedChange={(checked) => onCheckedChange(checked)} />
			</div>
			{nested ? <SettingNested>{nested}</SettingNested> : null}
		</div>
	);
}

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
