import { useLocalStorage } from "usehooks-ts";

import { useEmbedDisplaySettings } from "~/components/vehicles-map/embed-display-settings";

export function useDisplayAbsoluteRecordedTime() {
	const embedSettings = useEmbedDisplaySettings();
	const [displayAbsoluteTime, setDisplayAbsoluteTime] = useLocalStorage("display-absolute-time", false);
	if (embedSettings !== null) {
		return [embedSettings.displayAbsoluteRecordedTime, embedSettings.setDisplayAbsoluteRecordedTime] as const;
	}
	return [displayAbsoluteTime, setDisplayAbsoluteTime] as const;
}
