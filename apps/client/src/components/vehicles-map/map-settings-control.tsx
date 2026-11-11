import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
	BugIcon,
	BusIcon,
	HashIcon,
	HistoryIcon,
	ListOrderedIcon,
	LocateFixedIcon,
	MapPinIcon,
	MoonIcon,
	PaletteIcon,
	RouteIcon,
	SatelliteDishIcon,
	SunIcon,
	SunMoonIcon,
	TableIcon,
} from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { isRealtimeAvailable } from "~/api/realtime";
import {
	SettingChoice,
	SettingField,
	SettingSection,
	SettingToggle,
	settingIconClasses,
	settingOptionClasses,
	settingOptionStateClasses,
} from "~/components/setting-blocks";
import { useShowBikesAllowed, useShowWheelchairAccessibility } from "~/components/vehicles-map/accessibility-display";
import { useDisplayNextCalls } from "~/components/vehicles-map/display-next-calls";
import {
	type PositionType,
	positionTypes,
	useDisplayedPositionTypes,
} from "~/components/vehicles-map/displayed-position-types";
import { useGeolocateOnStart } from "~/components/vehicles-map/geolocate-on-start";
import { type MapThemeSetting, useMapThemeSetting } from "~/components/vehicles-map/map-style";
import { type PathDisplayMode, usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import {
	NextCallsDisplayModeChoice,
	RecordedTimeDisplayChoice,
	SettingsPopoverControl,
} from "~/components/vehicles-map/settings-popover";
import { useShowStops } from "~/components/vehicles-map/show-stops";
import type { StopLabelsStyle } from "~/components/vehicles-map/stop-labels-style";
import { type StopLinesDisplayMode, useStopLinesDisplayMode } from "~/components/vehicles-map/stop-lines-display-mode";
import { BikesAllowedIcon } from "~/icons/bikes-allowed";
import { WheelchairIcon } from "~/icons/wheelchair";
import * as m from "~/paraglide/messages";

const positionTypeDetails = {
	GPS: { iconClass: "text-green-600", label: m.settings_displayed_vehicles_gps },
	ESTIMATED: { iconClass: "text-orange-500", label: m.settings_displayed_vehicles_estimated },
	SCHEDULED: { iconClass: "text-red-600", label: m.settings_displayed_vehicles_scheduled },
} as const satisfies Record<PositionType, { iconClass: string; label: () => string }>;

function DisplayedVehiclesField() {
	const queryClient = useQueryClient();
	const [displayedPositionTypes, setDisplayedPositionTypes] = useDisplayedPositionTypes();

	const onToggle = (type: PositionType) => {
		setDisplayedPositionTypes(
			positionTypes.filter((value) =>
				value === type ? !displayedPositionTypes.includes(value) : displayedPositionTypes.includes(value),
			),
		);
		if (!isRealtimeAvailable()) queryClient.refetchQueries({ queryKey: ["vehicle-journeys"] });
	};

	return (
		<SettingField icon={<BusIcon className={settingIconClasses} />} label={m.settings_displayed_vehicles_label()}>
			<div className="grid grid-cols-3 gap-2">
				{positionTypes.map((type) => {
					const { iconClass, label } = positionTypeDetails[type];
					const selected = displayedPositionTypes.includes(type);

					return (
						<button
							key={type}
							aria-pressed={selected}
							className={clsx(settingOptionClasses, settingOptionStateClasses(selected))}
							disabled={selected && displayedPositionTypes.length === 1}
							type="button"
							onClick={() => onToggle(type)}
						>
							<SatelliteDishIcon className={clsx("size-4", selected ? iconClass : "opacity-50")} />
							<span className="text-xs leading-tight">{label()}</span>
						</button>
					);
				})}
			</div>
		</SettingField>
	);
}

export function MapSettingsControl() {
	const [mapTheme, setMapTheme] = useMapThemeSetting();
	const [geolocateOnStart, setGeolocateOnStart] = useGeolocateOnStart();
	const [previewVehicleNumber, setPreviewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);
	const [pathDisplayMode, setPathDisplayMode] = usePathDisplayMode();
	const [stopLabelsStyle, setStopLabelsStyle] = useLocalStorage<StopLabelsStyle>(
		"stop-labels-style",
		"with-background",
	);
	const [showIdentifiedVehiclesPanel, setShowIdentifiedVehiclesPanel] = useLocalStorage(
		"show-identified-vehicles-panel",
		false,
	);
	const [showStops, setShowStops] = useShowStops();
	const [stopLinesDisplayMode, setStopLinesDisplayMode] = useStopLinesDisplayMode();
	const [displayNextCalls, setDisplayNextCalls] = useDisplayNextCalls();
	const [showWheelchairAccessibility, setShowWheelchairAccessibility] = useShowWheelchairAccessibility();
	const [showBikesAllowed, setShowBikesAllowed] = useShowBikesAllowed();
	const [showDebugInfo, setShowDebugInfo] = useLocalStorage("show-debug-info", false);

	return (
		<SettingsPopoverControl>
			<SettingSection title={m.settings_map_section()}>
				<SettingChoice<MapThemeSetting>
					icon={<PaletteIcon className={settingIconClasses} />}
					label={m.settings_map_theme_label()}
					options={[
						{ value: "auto", label: m.settings_map_theme_auto(), icon: SunMoonIcon },
						{ value: "light", label: m.settings_map_theme_light(), icon: SunIcon },
						{ value: "dark", label: m.settings_map_theme_dark(), icon: MoonIcon },
					]}
					value={mapTheme}
					onChange={setMapTheme}
				/>
				<SettingToggle
					checked={geolocateOnStart}
					description={m.settings_geolocate_on_start_description()}
					icon={<LocateFixedIcon className={settingIconClasses} />}
					label={m.settings_geolocate_on_start_label()}
					onCheckedChange={setGeolocateOnStart}
				/>
			</SettingSection>

			<SettingSection title={m.settings_vehicles_section()}>
				<DisplayedVehiclesField />
				<SettingToggle
					checked={previewVehicleNumber}
					description={m.settings_preview_vehicle_number_description()}
					icon={<HashIcon className={settingIconClasses} />}
					label={m.settings_preview_vehicle_number_label()}
					onCheckedChange={setPreviewVehicleNumber}
				/>
				<SettingChoice<PathDisplayMode>
					icon={<RouteIcon className={settingIconClasses} />}
					label={m.settings_show_vehicle_paths_label()}
					nested={
						pathDisplayMode !== "disabled" && (
							<SettingChoice<StopLabelsStyle>
								label={m.settings_stop_labels_style_label()}
								options={[
									{ value: "disabled", label: m.settings_stop_labels_style_disabled() },
									{ value: "without-background", label: m.settings_stop_labels_style_without_background() },
									{ value: "with-background", label: m.settings_stop_labels_style_with_background() },
								]}
								value={stopLabelsStyle}
								onChange={setStopLabelsStyle}
							/>
						)
					}
					options={[
						{ value: "disabled", label: m.settings_show_vehicle_paths_disabled() },
						{ value: "journeys", label: m.settings_show_vehicle_paths_journeys() },
						{ value: "journeys-and-lines", label: m.settings_show_vehicle_paths_journeys_and_lines() },
					]}
					value={pathDisplayMode}
					onChange={setPathDisplayMode}
				/>
				<SettingToggle
					checked={showIdentifiedVehiclesPanel}
					description={m.settings_show_identified_vehicles_panel_description()}
					icon={<TableIcon className={settingIconClasses} />}
					label={m.settings_show_identified_vehicles_panel_label()}
					onCheckedChange={setShowIdentifiedVehiclesPanel}
				/>
			</SettingSection>

			<SettingSection title={m.settings_stops_section()}>
				<SettingToggle
					checked={showStops}
					description={m.settings_show_stops_description()}
					icon={<MapPinIcon className={settingIconClasses} />}
					label={m.settings_show_stops_label()}
					nested={
						showStops && (
							<SettingChoice<StopLinesDisplayMode>
								label={m.settings_stop_lines_display_label()}
								options={[
									{ value: "without", label: m.settings_stop_lines_display_without() },
									{ value: "with", label: m.settings_stop_lines_display_with() },
								]}
								value={stopLinesDisplayMode}
								onChange={setStopLinesDisplayMode}
							/>
						)
					}
					onCheckedChange={setShowStops}
				/>
			</SettingSection>

			<SettingSection title={m.settings_vehicle_card_section()}>
				<SettingToggle
					checked={displayNextCalls}
					description={m.settings_display_next_calls_description()}
					icon={<ListOrderedIcon className={settingIconClasses} />}
					label={m.settings_display_next_calls_label()}
					nested={displayNextCalls && <NextCallsDisplayModeChoice />}
					onCheckedChange={setDisplayNextCalls}
				/>
				<RecordedTimeDisplayChoice icon={<HistoryIcon className={settingIconClasses} />} />
			</SettingSection>

			<SettingSection title={m.settings_accessibility_section()}>
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
			</SettingSection>

			<SettingSection title={m.settings_expert_section()}>
				<SettingToggle
					checked={showDebugInfo}
					description={m.settings_show_debug_info_description()}
					icon={<BugIcon className={settingIconClasses} />}
					label={m.settings_show_debug_info_label()}
					onCheckedChange={setShowDebugInfo}
				/>
			</SettingSection>
		</SettingsPopoverControl>
	);
}
