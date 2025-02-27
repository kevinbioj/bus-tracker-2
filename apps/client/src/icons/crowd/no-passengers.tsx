import type { ComponentPropsWithoutRef } from "react";

type NoPassengersIconProps = Omit<ComponentPropsWithoutRef<"svg">, "xmlns" | "viewBox">;

export function NoPassengersIcon(props: Readonly<NoPassengersIconProps>) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: tooltip handles it
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" {...props}>
			<path d="m132.65 212.32l-96.44-74.54A63.4 63.4 0 0 0 32 160a63.84 63.84 0 0 0 100.65 52.32m40.44 62.28A63.79 63.79 0 0 0 128 256H64a64.06 64.06 0 0 0-64 64v32a32 32 0 0 0 32 32h65.91a146.62 146.62 0 0 1 75.18-109.4M544 224a64 64 0 1 0-64-64a64.06 64.06 0 0 0 64 64m-43.44 131.11a114.24 114.24 0 0 0-84.47-65.28L361 247.23c41.46-16.3 71-55.92 71-103.23A111.93 111.93 0 0 0 320 32c-57.14 0-103.69 42.83-110.6 98.08L45.46 3.38A16 16 0 0 0 23 6.19L3.37 31.46a16 16 0 0 0 2.81 22.45l588.35 454.72a16 16 0 0 0 22.47-2.81l19.64-25.27a16 16 0 0 0-2.81-22.45ZM128 403.21V432a48 48 0 0 0 48 48h288a47.45 47.45 0 0 0 12.57-1.87L232 289.13c-58.26 5.7-104 54.29-104 114.08M576 256h-64a63.79 63.79 0 0 0-45.09 18.6A146.29 146.29 0 0 1 542 384h66a32 32 0 0 0 32-32v-32a64.06 64.06 0 0 0-64-64" />
		</svg>
	);
}
