import {
	BrushIcon,
	ClipboardPasteIcon,
	CopyIcon,
	EraserIcon,
	MinusIcon,
	PencilIcon,
	RedoIcon,
	RotateCcwSquareIcon,
	ScissorsIcon,
	SquareDashedMousePointerIcon,
	SquareDotIcon,
	SquareIcon,
	TrashIcon,
	TypeIcon,
	UndoIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { ColorPicker } from "~/components/ui/color-picker";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
	BitmapCanvas,
	type BitmapGrid,
	decodeBitmap,
	encodeBitmap,
	type GirouetteBitmap,
	type LedColor,
	resizeBitmap,
} from "~/components/vehicles-map/vehicles-markers/popup/girouette-bitmap";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";
import { ALL_FONTS, type AllowedFont, DEFAULT_FONT_VARIANT, FONT_HEIGHTS, getFontLabel } from "./font-config";

/**
 * What a gesture on the surface does: outline a region to copy from, paint, or
 * clear. Each mode drives the row of controls sitting under the toolbar.
 */
type Mode = "select" | "draw" | "erase";

/** Shape the painting mode lays down, freehand unless a quick pattern is picked. */
type Pattern = "free" | "line" | "rectangle" | "filled-rectangle";

/** A pixel of the matrix, along with the color it is painted with (`null` = unlit). */
type Cell = { x: number; y: number; color: string | null };

/** A rectangular area of the matrix. */
type Region = { x: number; y: number; width: number; height: number };

/** Colors offered by the palette, covering the usual multicolor panels. */
const swatches = ["#FFFFFF", "#FF8000", "#FF0000", "#FFFF00", "#00FF00", "#00A0FF", "#FF00FF", "#000000"];

/**
 * Height left to the drawing surface once the toolbars, the text stamp panel and
 * the dialog chrome have taken their share of the viewport, with a floor so that
 * a very short window still shows something to draw on.
 */
const maxPaneHeight = "max(5rem, calc(100dvh - 26rem))";

/** Horizontal space the dialog gutter and the two paddings take from the viewport. */
const paneHorizontalChrome = "4.5rem";

/**
 * Largest the drawing surface can get without any scrolling: the whole width the
 * viewport leaves, unless the height caps it first. A destination pane is flat
 * enough for the width to decide; a route number block, barely twice as wide as
 * it is tall, is bounded by the height instead — and the dialog then narrows down
 * to it rather than framing it with black.
 */
function paneWidthExpression(width: number, height: number) {
	return `min(calc(100dvw - ${paneHorizontalChrome}), calc(${maxPaneHeight} * ${width} / ${height}))`;
}

function bresenham(from: { x: number; y: number }, to: { x: number; y: number }) {
	const points: { x: number; y: number }[] = [];
	let { x, y } = from;
	const dx = Math.abs(to.x - x);
	const dy = -Math.abs(to.y - y);
	const sx = x < to.x ? 1 : -1;
	const sy = y < to.y ? 1 : -1;
	let error = dx + dy;

	while (true) {
		points.push({ x, y });
		if (x === to.x && y === to.y) break;
		const doubled = 2 * error;
		if (doubled >= dy) {
			error += dy;
			x += sx;
		}
		if (doubled <= dx) {
			error += dx;
			y += sy;
		}
	}

	return points;
}

function rectangle(from: { x: number; y: number }, to: { x: number; y: number }, filled: boolean) {
	const x1 = Math.min(from.x, to.x);
	const x2 = Math.max(from.x, to.x);
	const y1 = Math.min(from.y, to.y);
	const y2 = Math.max(from.y, to.y);
	const points: { x: number; y: number }[] = [];
	for (let y = y1; y <= y2; y += 1) {
		for (let x = x1; x <= x2; x += 1) {
			if (filled || x === x1 || x === x2 || y === y1 || y === y2) points.push({ x, y });
		}
	}
	return points;
}

function regionOf(from: { x: number; y: number }, to: { x: number; y: number }): Region {
	return {
		x: Math.min(from.x, to.x),
		y: Math.min(from.y, to.y),
		width: Math.abs(to.x - from.x) + 1,
		height: Math.abs(to.y - from.y) + 1,
	};
}

/** Pixels of a region, with their colors, relative to its top-left corner. */
function regionCells(region: Region, grid: BitmapGrid): Cell[] {
	const cells: Cell[] = [];
	for (let y = 0; y < region.height; y += 1) {
		for (let x = 0; x < region.width; x += 1) {
			cells.push({ x, y, color: grid[region.y + y]?.[region.x + x] ?? null });
		}
	}
	return cells;
}

function contains(region: Region, cell: { x: number; y: number }) {
	return (
		cell.x >= region.x && cell.x < region.x + region.width && cell.y >= region.y && cell.y < region.y + region.height
	);
}

function clearedCells(region: Region): Cell[] {
	const cells: Cell[] = [];
	for (let y = region.y; y < region.y + region.height; y += 1) {
		for (let x = region.x; x < region.x + region.width; x += 1) {
			cells.push({ x, y, color: null });
		}
	}
	return cells;
}

function applyCells(grid: BitmapGrid, cells: Cell[]): BitmapGrid {
	const next = grid.map((row) => [...row]);
	for (const { x, y, color } of cells) {
		if (y < 0 || y >= next.length || x < 0 || x >= (next[0]?.length ?? 0)) continue;
		next[y][x] = color;
	}
	return next;
}

/**
 * Draws a text with one of the girouette fonts into an offscreen canvas and reads
 * it back as lit pixels, so that it can be dropped into the drawing and touched
 * up pixel by pixel afterwards.
 */
async function rasterizeText(text: string, font: AllowedFont, spacing: number) {
	const fontSize = FONT_HEIGHTS[font];
	const fontSpec = `${fontSize}px "${font}"`;
	try {
		await document.fonts.load(fontSpec, text);
	} catch {
		// The font may already be loaded (or fail to be): rendering with whatever
		// is available beats refusing to stamp anything.
	}

	const canvas = document.createElement("canvas");
	const measuring = canvas.getContext("2d");
	if (measuring === null) return null;
	measuring.font = fontSpec;
	const width = Math.ceil(measuring.measureText(text).width) + spacing * text.length + 4;

	canvas.width = Math.max(1, width);
	// The extra room absorbs the ascenders and descenders the font may place
	// outside of its nominal box; the bounding box below trims it back.
	canvas.height = fontSize * 2;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (context === null) return null;
	// Resizing the canvas resets its state, so the drawing settings come after.
	context.font = fontSpec;
	if ("letterSpacing" in context) context.letterSpacing = `${spacing}px`;
	context.textBaseline = "middle";
	context.fillStyle = "#FFFFFF";
	context.fillText(text, 1, fontSize);

	const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
	const points: { x: number; y: number }[] = [];
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let y = 0; y < canvas.height; y += 1) {
		for (let x = 0; x < canvas.width; x += 1) {
			if (data[(y * canvas.width + x) * 4 + 3] < 128) continue;
			points.push({ x, y });
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (points.length === 0) return null;
	return {
		width: maxX - minX + 1,
		height: maxY - minY + 1,
		points: points.map(({ x, y }) => ({ x: x - minX, y: y - minY })),
	};
}

/**
 * A block waiting to be dropped: either a rasterized text, painted with whatever
 * color is selected, or a copied region, which keeps the colors of its own pixels.
 */
type Stamp = {
	width: number;
	height: number;
	cells: Cell[];
	/** Paints every cell with the current color instead of the one it carries. */
	inheritColor: boolean;
};

/** Cells a stamp writes when dropped with its top-left corner on `position`. */
function stampCells(stamp: Stamp, position: { x: number; y: number }, paintColor: string): Cell[] {
	return stamp.cells.map(({ x, y, color }) => ({
		x: position.x + x,
		y: position.y + y,
		color: stamp.inheritColor ? paintColor : color,
	}));
}

type BitmapEditorProps = {
	className?: string;
	/** Height of the pane, in matrix pixels. */
	height: number;
	ledColor: LedColor;
	onChange: (bitmap: GirouetteBitmap) => void;
	value: GirouetteBitmap;
	/** Width of the pane, in matrix pixels. */
	width: number;
};

export function BitmapEditor({ className, height, ledColor, onChange, value, width }: Readonly<BitmapEditorProps>) {
	const [mode, setMode] = useState<Mode>("draw");
	const [pattern, setPattern] = useState<Pattern>("free");
	const [color, setColor] = useState<string>(swatches[0]);
	const [customColor, setCustomColor] = useState("");

	const [past, setPast] = useState<GirouetteBitmap[]>([]);
	const [future, setFuture] = useState<GirouetteBitmap[]>([]);
	const [clearOpen, setClearOpen] = useState(false);

	// Set while the pointer is down: nothing but a freehand stroke is written
	// before it is released, so the preview is drawn over the untouched value.
	const [drag, setDrag] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
	const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null);

	/** Region outlined by the selection mode, kept once the pointer is released. */
	const [selection, setSelection] = useState<Region | null>(null);
	/** Set while the selected region is being dragged to another place. */
	const [moving, setMoving] = useState<{
		source: Region;
		cells: Cell[];
		/** Where inside the region the pointer grabbed it. */
		grabX: number;
		grabY: number;
		/** Top-left corner the region is currently dropped on. */
		x: number;
		y: number;
	} | null>(null);
	const [hoveringSelection, setHoveringSelection] = useState(false);
	const [clipboard, setClipboard] = useState<{ width: number; height: number; cells: Cell[] } | null>(null);

	const [stamp, setStamp] = useState<Stamp | null>(null);
	const [stampPosition, setStampPosition] = useState<{ x: number; y: number } | null>(null);
	const [stampText, setStampText] = useState("");
	const [stampFont, setStampFont] = useState<AllowedFont>(DEFAULT_FONT_VARIANT);
	const [stampSpacing, setStampSpacing] = useState(1);

	const surfaceRef = useRef<HTMLDivElement>(null);

	// A block held by the pointer is dismissed by Escape or by a click anywhere but
	// the drawing surface, which is why it needs no instructions of its own on screen.
	useEffect(() => {
		if (stamp === null) return;

		const dismiss = () => {
			setStamp(null);
			setStampPosition(null);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			// Captured before it reaches the dialog, which would otherwise close on
			// the same key press.
			event.stopPropagation();
			dismiss();
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && surfaceRef.current?.contains(event.target)) return;
			dismiss();
		};

		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [stamp]);

	// The pane may have been resized since the drawing was made (the route number
	// block collapsing, for instance): everything works on the current size.
	const bitmap = resizeBitmap(value, width, height);
	const grid = decodeBitmap(bitmap);

	const previewCells: Cell[] = (() => {
		if (moving !== null) {
			return [
				...clearedCells(moving.source),
				...moving.cells.map(({ x, y, color: cellColor }) => ({ x: moving.x + x, y: moving.y + y, color: cellColor })),
			];
		}
		if (stamp !== null && stampPosition !== null) return stampCells(stamp, stampPosition, color);
		if (drag === null || mode !== "draw" || pattern === "free") return [];
		const points =
			pattern === "line" ? bresenham(drag.from, drag.to) : rectangle(drag.from, drag.to, pattern !== "rectangle");
		return points.map(({ x, y }) => ({ x, y, color }));
	})();

	// Selecting and erasing outline the region instead of painting it: neither
	// changes anything until the pointer is released.
	const outlinedRegion =
		moving !== null
			? { x: moving.x, y: moving.y, width: moving.source.width, height: moving.source.height }
			: mode === "draw"
				? null
				: drag !== null
					? regionOf(drag.from, drag.to)
					: mode === "select"
						? selection
						: null;

	const displayedBitmap = previewCells.length > 0 ? encodeBitmap(applyCells(grid, previewCells)) : bitmap;

	const commit = (cells: Cell[], { snapshot = true } = {}) => {
		if (cells.length === 0) return;
		if (snapshot) {
			setPast((history) => [...history, bitmap]);
			setFuture([]);
		}
		onChange(encodeBitmap(applyCells(grid, cells)));
	};

	const undo = () => {
		const previous = past.at(-1);
		if (previous === undefined) return;
		setPast((history) => history.slice(0, -1));
		setFuture((history) => [...history, bitmap]);
		onChange(previous);
	};

	const redo = () => {
		const next = future.at(-1);
		if (next === undefined) return;
		setFuture((history) => history.slice(0, -1));
		setPast((history) => [...history, bitmap]);
		onChange(next);
	};

	const clear = () => {
		setPast((history) => [...history, bitmap]);
		setFuture([]);
		onChange(encodeBitmap(grid.map((row) => row.map(() => null))));
	};

	const copySelection = () => {
		if (selection === null) return;
		setClipboard({ width: selection.width, height: selection.height, cells: regionCells(selection, grid) });
	};

	const cutSelection = () => {
		if (selection === null) return;
		copySelection();
		commit(clearedCells(selection));
		setSelection(null);
	};

	const pasteClipboard = () => {
		if (clipboard === null) return;
		setStamp({ ...clipboard, inheritColor: false });
		setStampPosition(null);
	};

	const cellFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
		const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);
		return { x: Math.min(Math.max(x, 0), width - 1), y: Math.min(Math.max(y, 0), height - 1) };
	};

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		const cell = cellFromEvent(event);

		// A block waiting to be placed takes precedence: the click drops it.
		if (stamp !== null) {
			commit(stampCells(stamp, cell, color));
			setStamp(null);
			setStampPosition(null);
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);

		// Pressing inside the selection picks it up instead of starting another one.
		if (mode === "select" && selection !== null && contains(selection, cell)) {
			setMoving({
				source: selection,
				cells: regionCells(selection, grid),
				grabX: cell.x - selection.x,
				grabY: cell.y - selection.y,
				x: selection.x,
				y: selection.y,
			});
			return;
		}

		if (mode === "select") setSelection(null);
		if (mode === "draw" && pattern === "free") {
			commit([{ ...cell, color }]);
			setLastCell(cell);
		}
		setDrag({ from: cell, to: cell });
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const cell = cellFromEvent(event);

		if (moving !== null) {
			// Clamped so that a dragged region never loses the pixels that would
			// otherwise slide past an edge.
			const x = Math.min(Math.max(cell.x - moving.grabX, 0), width - moving.source.width);
			const y = Math.min(Math.max(cell.y - moving.grabY, 0), height - moving.source.height);
			if (x !== moving.x || y !== moving.y) setMoving({ ...moving, x, y });
			return;
		}

		if (stamp !== null) {
			setStampPosition(cell);
			return;
		}

		if (drag === null) {
			// Drives the cursor, so that a grabbable selection announces itself.
			const hovering = mode === "select" && selection !== null && contains(selection, cell);
			setHoveringSelection((current) => (current === hovering ? current : hovering));
			return;
		}
		if (mode === "draw" && pattern === "free") {
			// Joining the two cells keeps the stroke continuous however fast the
			// pointer moves, which is easily faster than one pixel per event.
			const points = lastCell === null ? [cell] : bresenham(lastCell, cell);
			commit(
				points.map(({ x, y }) => ({ x, y, color })),
				{ snapshot: false },
			);
			setLastCell(cell);
		}
		setDrag({ from: drag.from, to: cell });
	};

	const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		if (moving !== null) {
			const moved = moving.x !== moving.source.x || moving.y !== moving.source.y;
			if (moved) {
				commit([
					...clearedCells(moving.source),
					...moving.cells.map(({ x, y, color: cellColor }) => ({
						x: moving.x + x,
						y: moving.y + y,
						color: cellColor,
					})),
				]);
			}
			setSelection({ x: moving.x, y: moving.y, width: moving.source.width, height: moving.source.height });
			setMoving(null);
			return;
		}

		if (drag !== null) {
			const region = regionOf(drag.from, drag.to);
			if (mode === "select") setSelection(region);
			// A plain click and a dragged region are the same gesture here: the first
			// clears a single pixel, the second the whole area.
			else if (mode === "erase") commit(clearedCells(region));
			else if (previewCells.length > 0) commit(previewCells);
		}

		setDrag(null);
		setLastCell(null);
	};

	const handlePrepareStamp = async () => {
		const text = stampText.trim();
		if (text === "") return;
		const rasterized = await rasterizeText(text, stampFont, stampSpacing);
		if (rasterized === null) return;
		setStamp({
			width: rasterized.width,
			height: rasterized.height,
			cells: rasterized.points.map(({ x, y }) => ({ x, y, color: null })),
			inheritColor: true,
		});
		setStampPosition(null);
	};

	const modes: { value: Mode; icon: typeof PencilIcon; label: string }[] = [
		{ value: "select", icon: SquareDashedMousePointerIcon, label: m.line_girouettes_form_bitmap_mode_select() },
		{ value: "draw", icon: PencilIcon, label: m.line_girouettes_form_bitmap_mode_draw() },
		{ value: "erase", icon: EraserIcon, label: m.line_girouettes_form_bitmap_mode_erase() },
	];

	const patterns: { value: Pattern; icon: typeof PencilIcon; label: string }[] = [
		{ value: "free", icon: PencilIcon, label: m.line_girouettes_form_bitmap_pattern_free() },
		{ value: "line", icon: MinusIcon, label: m.line_girouettes_form_bitmap_tool_line() },
		{ value: "rectangle", icon: SquareIcon, label: m.line_girouettes_form_bitmap_tool_rectangle() },
		{ value: "filled-rectangle", icon: SquareDotIcon, label: m.line_girouettes_form_bitmap_tool_filled_rectangle() },
	];

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-1">
					{modes.map(({ value: modeValue, icon: Icon, label }) => (
						<Button
							key={modeValue}
							type="button"
							variant={mode === modeValue ? "branding-default" : "outline"}
							size="icon-sm"
							title={label}
							aria-label={label}
							aria-pressed={mode === modeValue}
							onClick={() => setMode(modeValue)}
						>
							<Icon />
						</Button>
					))}
				</div>

				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						title={m.line_girouettes_form_bitmap_undo()}
						aria-label={m.line_girouettes_form_bitmap_undo()}
						disabled={past.length === 0}
						onClick={undo}
					>
						<UndoIcon />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						title={m.line_girouettes_form_bitmap_redo()}
						aria-label={m.line_girouettes_form_bitmap_redo()}
						disabled={future.length === 0}
						onClick={redo}
					>
						<RedoIcon />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						title={m.line_girouettes_form_bitmap_clear()}
						aria-label={m.line_girouettes_form_bitmap_clear()}
						onClick={() => setClearOpen(true)}
					>
						<TrashIcon className="text-destructive" />
					</Button>
				</div>

				{/* Only the painting mode lays down shapes; the group keeps its place in
				    the other two so that the toolbar never jumps around. */}
				<div className={cn("ml-auto flex items-center gap-1", mode !== "draw" && "opacity-0")} inert={mode !== "draw"}>
					{patterns.map(({ value: patternValue, icon: Icon, label }) => (
						<Button
							key={patternValue}
							type="button"
							variant={pattern === patternValue ? "branding-default" : "outline"}
							size="icon-sm"
							title={label}
							aria-label={label}
							aria-pressed={pattern === patternValue}
							onClick={() => setPattern(patternValue)}
						>
							<Icon />
						</Button>
					))}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{/* Clipboard actions when a region is being worked on, the palette when
				    painting, and nothing — but the same height — when erasing. */}
				<div
					className={cn("flex min-h-8 flex-wrap items-center gap-2", mode === "erase" && "opacity-0")}
					inert={mode === "erase"}
				>
					{mode === "select" ? (
						<div className="flex items-center gap-1">
							<Button type="button" variant="outline" size="sm" disabled={selection === null} onClick={copySelection}>
								<CopyIcon />
								{m.line_girouettes_form_bitmap_copy()}
							</Button>
							<Button type="button" variant="outline" disabled={selection === null} onClick={cutSelection}>
								<ScissorsIcon />
								{m.line_girouettes_form_bitmap_cut()}
							</Button>
							<Button type="button" variant="outline" size="sm" disabled={clipboard === null} onClick={pasteClipboard}>
								<ClipboardPasteIcon />
								{m.line_girouettes_form_bitmap_paste()}
							</Button>
						</div>
					) : (
						<>
							<div className="flex items-center gap-1">
								{swatches.map((swatch) => (
									<ColorSwatch
										key={swatch}
										color={swatch}
										label={swatch}
										selected={color === swatch}
										onSelect={() => setColor(swatch)}
									/>
								))}
								{/^#[0-9A-Fa-f]{6}$/.test(customColor) && (
									<ColorSwatch
										color={customColor}
										label={customColor}
										selected={color === customColor.toUpperCase()}
										onSelect={() => setColor(customColor.toUpperCase())}
									/>
								)}
							</div>
							<ColorPicker
								className="w-40"
								value={customColor}
								onChange={(value) => {
									setCustomColor(value);
									if (/^#[0-9A-Fa-f]{6}$/.test(value)) setColor(value.toUpperCase());
								}}
							/>
						</>
					)}
				</div>

				<span className="ml-auto text-xs text-muted-foreground tabular-nums select-none">
					{m.line_girouettes_form_bitmap_size({ width, height })}
				</span>
			</div>

			{/* Shrunk to the surface, so that the panel never shows black bands around it. */}
			<div className="mx-auto w-fit bg-[#1D1D1B] p-2" ref={surfaceRef}>
				<div
					className="relative touch-none select-none"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
					style={{
						cursor:
							moving !== null
								? "grabbing"
								: stamp !== null
									? "copy"
									: hoveringSelection && mode === "select" && selection !== null
										? "grab"
										: "crosshair",
						width: paneWidthExpression(width, height),
						aspectRatio: `${width} / ${height}`,
					}}
				>
					<BitmapCanvas
						bitmap={displayedBitmap}
						ledColor={ledColor}
						pixelSize={1}
						style={{ display: "block", width: "100%", height: "100%" }}
					/>
					<div
						className="pointer-events-none absolute inset-0 opacity-25"
						style={{
							backgroundImage:
								"linear-gradient(to right, #6B7280 1px, transparent 1px), linear-gradient(to bottom, #6B7280 1px, transparent 1px)",
							backgroundSize: `${100 / width}% ${100 / height}%`,
							// The gradients only rule the left and top edge of each cell: the
							// last column and the last row are closed by the inset shadow.
							boxShadow: "inset -1px 0 0 #6B7280, inset 0 -1px 0 #6B7280",
						}}
					/>
					{outlinedRegion !== null && (
						<div
							className="pointer-events-none absolute border border-dashed border-white"
							style={{
								left: `${(outlinedRegion.x / width) * 100}%`,
								top: `${(outlinedRegion.y / height) * 100}%`,
								width: `${(outlinedRegion.width / width) * 100}%`,
								height: `${(outlinedRegion.height / height) * 100}%`,
							}}
						/>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-2">
				<div className="flex items-center gap-1.5">
					<TypeIcon className="size-3.5 text-muted-foreground" />
					<Label>{m.line_girouettes_form_bitmap_stamp_title()}</Label>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<Input
						className="min-w-0 flex-1"
						value={stampText}
						onChange={(event) => setStampText(event.target.value)}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;
							// The dialog is portalled out of the girouette form, but a React
							// event still bubbles through the tree it was declared in: both
							// the native default and that propagation have to be stopped for
							// the key press to mean nothing but "prepare this stamp".
							event.preventDefault();
							event.stopPropagation();
							handlePrepareStamp();
						}}
						placeholder={m.line_girouettes_form_bitmap_stamp_placeholder()}
					/>
					<Select
						value={stampFont}
						onValueChange={(v) => setStampFont(v as AllowedFont)}
						items={ALL_FONTS.map((font) => ({ value: font, label: getFontLabel(font) }))}
					>
						<SelectTrigger className="sm:w-52">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ALL_FONTS.map((font) => (
								<SelectItem key={font} value={font}>
									{getFontLabel(font)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{/* Letter spacing of the rasterized text, in matrix pixels. */}
					<div className="flex shrink-0 items-center gap-1.5">
						<Label className="text-xs whitespace-nowrap text-muted-foreground">
							{m.line_girouettes_form_spacing_label()}
						</Label>
						<Input
							className="w-16"
							type="number"
							min={0}
							max={10}
							value={stampSpacing}
							onChange={(event) => setStampSpacing(Math.min(Math.max(Number(event.target.value) || 0, 0), 10))}
							aria-label={m.line_girouettes_form_spacing_label()}
						/>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={handlePrepareStamp} disabled={!stampText.trim()}>
						{m.line_girouettes_form_bitmap_stamp_prepare()}
					</Button>
				</div>
			</div>

			<Dialog open={clearOpen} onOpenChange={setClearOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{m.line_girouettes_form_bitmap_clear_title()}</DialogTitle>
						<DialogDescription>{m.line_girouettes_form_bitmap_clear_description()}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline">
									{m.line_girouettes_form_cancel()}
								</Button>
							}
						/>
						<Button
							type="button"
							variant="destructive"
							onClick={() => {
								clear();
								setClearOpen(false);
							}}
						>
							<TrashIcon />
							{m.line_girouettes_form_bitmap_clear()}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ---

type ColorSwatchProps = {
	color: string;
	label: string;
	onSelect: () => void;
	selected: boolean;
};

function ColorSwatch({ color, label, onSelect, selected }: Readonly<ColorSwatchProps>) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"size-7 rounded-md border transition-colors",
				selected ? "border-foreground ring-2 ring-ring/50" : "border-input hover:border-ring",
			)}
			style={{ backgroundColor: color }}
		/>
	);
}

// ---

/**
 * A pane is far wider than it is tall, so a phone held upright leaves barely a
 * couple of pixels per matrix pixel. The orientation is locked to landscape
 * whenever the browser allows it — which requires fullscreen — and a hint takes
 * over when it doesn't.
 */
function useLandscapeLock(active: boolean) {
	// Only a touch screen is ever rotated: a portrait desktop window is a
	// deliberate size the editor has no business taking over.
	const [shouldRotate, setShouldRotate] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
		const update = () => setShouldRotate(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	useEffect(() => {
		if (!active || !window.matchMedia("(pointer: coarse)").matches) return;

		const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
		if (typeof orientation?.lock !== "function") return;

		let locked = false;
		(async () => {
			try {
				// Both steps may be refused (iOS has no lock at all, and fullscreen
				// needs a user gesture): the rotation hint stands in for them.
				if (document.fullscreenElement === null) await document.documentElement.requestFullscreen?.();
				await orientation.lock("landscape");
				locked = true;
			} catch {
				// Nothing to undo: whatever succeeded is released below anyway.
			}
		})();

		return () => {
			if (locked) orientation.unlock?.();
			if (document.fullscreenElement !== null) document.exitFullscreen?.().catch(() => {});
		};
	}, [active]);

	return shouldRotate;
}

type BitmapEditorDialogProps = BitmapEditorProps & {
	/** Names the pane being drawn, in the title of the dialog. */
	title: string;
};

/**
 * Opens the drawing surface in a dialog rather than inline: a pane is 192 pixels
 * wide and the tools take a row of their own, which the form column can't hold
 * without cramping everything else.
 */
export function BitmapEditorDialog({ className, title, ...editorProps }: Readonly<BitmapEditorDialogProps>) {
	const [open, setOpen] = useState(false);
	// Snapshot taken when the dialog opens, so that cancelling puts the pane back
	// the way it was however many strokes have been drawn meanwhile.
	const [snapshot, setSnapshot] = useState<GirouetteBitmap | null>(null);
	const shouldRotate = useLandscapeLock(open);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) setSnapshot(editorProps.value);
		setOpen(nextOpen);
	};

	const cancel = () => {
		if (snapshot !== null) editorProps.onChange(snapshot);
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button className={cn("w-full", className)} type="button" variant="outline">
						<BrushIcon />
						{m.line_girouettes_form_bitmap_open()}
					</Button>
				}
			/>
			{/* A pane is ten times wider than it is tall, so what a drawing needs is
			    width: the dialog spans the viewport and keeps its height to its content. */}
			{/* `sm:max-w-none` is spelled out because the `sm:max-w-lg` DialogContent
			    carries by default wins over a plain `max-w-none`. */}
			<DialogContent
				className="flex max-h-dvh max-w-none flex-col gap-3 sm:max-w-none"
				style={{
					// Wide enough for the surface and its paddings, never wider than the
					// viewport, and never so narrow that the toolbars have to wrap.
					width: `min(calc(100dvw - 1.5rem), max(30rem, calc(${paneWidthExpression(editorProps.width, editorProps.height)} + 3rem)))`,
				}}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				{shouldRotate && (
					<p className="flex items-center gap-2 rounded-lg border border-dashed border-foreground/20 p-2 text-xs text-muted-foreground">
						<RotateCcwSquareIcon className="size-4 shrink-0" />
						{m.line_girouettes_form_bitmap_rotate_hint()}
					</p>
				)}

				<BitmapEditor className="min-h-0 overflow-y-auto" {...editorProps} />

				<DialogFooter>
					<Button type="button" variant="outline" onClick={cancel}>
						{m.line_girouettes_form_cancel()}
					</Button>
					<DialogClose
						render={
							<Button type="button" variant="branding-default">
								{m.line_girouettes_form_bitmap_done()}
							</Button>
						}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
