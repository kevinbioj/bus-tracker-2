import { crc32, deflateSync } from "node:zlib";
import { AllAppleDeviceNames, appleSplashScreenSizes } from "@vite-pwa/assets-generator/config";
import type { HtmlTagDescriptor, Plugin } from "vite";

function pngChunk(type: string, data: Buffer) {
	const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const chunk = Buffer.alloc(typeAndData.length + 8);
	chunk.writeUInt32BE(data.length, 0);
	typeAndData.copy(chunk, 4);
	chunk.writeUInt32BE(crc32(typeAndData), typeAndData.length + 4);
	return chunk;
}

function solidColorPng(width: number, height: number, color: string) {
	const rgb = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
	const row = Buffer.alloc(1 + width * 3);
	for (let x = 0; x < width; x += 1) row.set(rgb, 1 + x * 3);

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 2;

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk("IHDR", header),
		pngChunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)), { level: 9 })),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

export function appleSplashScreens({ color }: { color: string }): Plugin {
	const screens = [
		...new Map(
			AllAppleDeviceNames.map((name) => {
				const size = appleSplashScreenSizes[name];
				return [`${size.width}x${size.height}@${size.scaleFactor}`, size] as const;
			}),
		).values(),
	].flatMap((size) =>
		(["portrait", "landscape"] as const).map((orientation) => {
			const [width, height] = orientation === "portrait" ? [size.width, size.height] : [size.height, size.width];
			return {
				fileName: `splash/${width}x${height}.png`,
				width,
				height,
				media: [
					"screen",
					`(device-width: ${size.width / size.scaleFactor}px)`,
					`(device-height: ${size.height / size.scaleFactor}px)`,
					`(-webkit-device-pixel-ratio: ${size.scaleFactor})`,
					`(orientation: ${orientation})`,
				].join(" and "),
			};
		}),
	);

	return {
		name: "apple-splash-screens",
		apply: "build",
		transformIndexHtml: () =>
			screens.map(
				({ fileName, media }): HtmlTagDescriptor => ({
					tag: "link",
					attrs: { rel: "apple-touch-startup-image", media, href: `/${fileName}` },
					injectTo: "head",
				}),
			),
		generateBundle() {
			for (const { fileName, width, height } of screens) {
				this.emitFile({ type: "asset", fileName, source: solidColorPng(width, height, color) });
			}
		},
	};
}
