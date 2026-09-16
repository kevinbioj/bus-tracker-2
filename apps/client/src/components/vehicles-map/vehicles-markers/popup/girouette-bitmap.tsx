import { type ComponentPropsWithoutRef, useEffect, useRef } from "react";

export const ledColors = {
	YELLOW: "#FF8000",
	WHITE: "#F2FBFF",
} as const;
export type LedColor = keyof typeof ledColors;

/**
 * Palette entry standing for the current LED color of the girouette rather than
 * a fixed color: a drawing made with it follows the panel it is displayed on.
 */
export const LED_PALETTE_ENTRY = "led";

/** Character marking an unlit pixel; every other one indexes the palette. */
const OFF = ".";

/** Palette indices are encoded as a single base-36 digit, hence the limit. */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
export const MAX_PALETTE_SIZE = DIGITS.length;

/**
 * A freely drawn girouette pane, as a matrix of pixels. The colors live in a
 * palette so that a row stays one character per pixel, which keeps the stored
 * girouette both compact and readable.
 */
export type GirouetteBitmap = {
	width: number;
	height: number;
	palette: string[];
	/** One string per matrix row, `width` characters long. */
	rows: string[];
};

/** Color of each pixel, `null` when unlit, indexed as `grid[y][x]`. */
export type BitmapGrid = (string | null)[][];

export function createGrid(width: number, height: number): BitmapGrid {
	return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

export function createBitmap(width: number, height: number): GirouetteBitmap {
	return encodeBitmap(createGrid(width, height));
}

export function decodeBitmap(bitmap: GirouetteBitmap): BitmapGrid {
	return Array.from({ length: bitmap.height }, (_, y) => {
		const row = bitmap.rows[y] ?? "";
		return Array.from({ length: bitmap.width }, (_, x) => {
			const digit = row[x] ?? OFF;
			if (digit === OFF) return null;
			const index = DIGITS.indexOf(digit);
			return bitmap.palette[index] ?? null;
		});
	});
}

/** Encodes a grid, rebuilding the palette so that dropped colors don't linger. */
export function encodeBitmap(grid: BitmapGrid): GirouetteBitmap {
	const palette: string[] = [];
	const rows = grid.map((row) =>
		row
			.map((color) => {
				if (color === null) return OFF;
				let index = palette.indexOf(color);
				if (index === -1) {
					// Beyond the 36 encodable colors the pixel is dropped rather than
					// mis-encoded; the editor caps the palette well below that anyway.
					if (palette.length === MAX_PALETTE_SIZE) return OFF;
					index = palette.push(color) - 1;
				}
				return DIGITS[index];
			})
			.join(""),
	);
	return { width: grid[0]?.length ?? 0, height: grid.length, palette, rows };
}

/**
 * Fits a bitmap to a pane of another size, keeping the drawing anchored to the
 * top-left corner: extra space is left unlit and overflow is cropped away.
 */
export function resizeBitmap(bitmap: GirouetteBitmap, width: number, height: number): GirouetteBitmap {
	if (bitmap.width === width && bitmap.height === height) return bitmap;
	const source = decodeBitmap(bitmap);
	const grid = createGrid(width, height);
	for (let y = 0; y < Math.min(height, bitmap.height); y += 1) {
		for (let x = 0; x < Math.min(width, bitmap.width); x += 1) {
			grid[y][x] = source[y][x];
		}
	}
	return encodeBitmap(grid);
}

export function isBitmapEmpty(bitmap: GirouetteBitmap): boolean {
	return bitmap.palette.length === 0 || bitmap.rows.every((row) => [...row].every((digit) => digit === OFF));
}

export function resolveColor(entry: string, ledColor: LedColor): string {
	return entry === LED_PALETTE_ENTRY ? ledColors[ledColor] : entry;
}

// ---

type BitmapCanvasProps = Omit<ComponentPropsWithoutRef<"canvas">, "height" | "width"> & {
	bitmap: GirouetteBitmap;
	ledColor: LedColor;
	/** Size of a single matrix pixel, in CSS pixels. */
	pixelSize: number;
};

/**
 * Renders a bitmap at its native resolution and lets the browser scale it up
 * without smoothing, so that a matrix pixel stays a crisp square whatever the
 * size the girouette is displayed at.
 */
export function BitmapCanvas({ bitmap, ledColor, pixelSize, style, ...props }: Readonly<BitmapCanvasProps>) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		const context = canvas?.getContext("2d");
		if (canvas === null || context == null) return;

		context.clearRect(0, 0, bitmap.width, bitmap.height);
		const grid = decodeBitmap(bitmap);
		for (let y = 0; y < bitmap.height; y += 1) {
			for (let x = 0; x < bitmap.width; x += 1) {
				const color = grid[y][x];
				if (color === null) continue;
				context.fillStyle = resolveColor(color, ledColor);
				context.fillRect(x, y, 1, 1);
			}
		}
	}, [bitmap, ledColor]);

	return (
		<canvas
			height={bitmap.height}
			ref={ref}
			style={{
				imageRendering: "pixelated",
				width: `${bitmap.width * pixelSize}px`,
				height: `${bitmap.height * pixelSize}px`,
				...style,
			}}
			width={bitmap.width}
			{...props}
		/>
	);
}
