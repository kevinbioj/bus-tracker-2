import type { Line } from "~/api/networks";

export const LINE_BADGES_FONT = "bold 13px Achemine";

const LINE_BADGE_HEIGHT = 18;

const BADGE_MIN_WIDTH = 24;
const BADGE_MAX_WIDTH = 96;
const BADGE_PADDING_X = 3.5;
const BADGE_GAP = 2;
const BADGE_RADIUS = 3;
const OUTLINE_WIDTH = 0.5;

const LINE_BADGES_HEIGHT = LINE_BADGE_HEIGHT + OUTLINE_WIDTH * 2;

const DEFAULT_COLOR = "#18181B";
const DEFAULT_TEXT_COLOR = "#FFFFFF";
const OUTLINE_COLOR = "#FFFFFF";
const MORE_COLOR = "#E4E4E7";
const MORE_TEXT_COLOR = "#1E2A4A";

export const MAX_LINE_BADGES = 5;

export type LineBadges = { lines: Line[]; more: number };

type BadgeBox = { x: number; y: number; width: number; height: number };

const moreBadgeBoxes = new Map<string, BadgeBox>();

export const getMoreBadgeBox = (imageId: string) => moreBadgeBoxes.get(imageId);

export const lineBadgesImageId = ({ lines, more }: LineBadges) =>
	`line-badges-${lines.map(({ id }) => id).join("-")}${more > 0 ? `-plus-${more}` : ""}`;

function fitLabel(ctx: CanvasRenderingContext2D, label: string, maxWidth: number) {
	if (ctx.measureText(label).width <= maxWidth) return label;

	let text = label;
	while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
		text = text.slice(0, -1);
	}
	return `${text}…`;
}

let measureContext: CanvasRenderingContext2D | undefined;

function getMeasureContext() {
	measureContext ??= document.createElement("canvas").getContext("2d")!;
	measureContext.font = LINE_BADGES_FONT;
	return measureContext;
}

type Badge = { label: string; color: string; textColor: string; more?: boolean };

export function createLineBadges(lineBadges: LineBadges) {
	const { lines, more } = lineBadges;
	const scale = window.devicePixelRatio;
	const measure = getMeasureContext();

	const capHeight = measure.measureText("H").actualBoundingBoxAscent;
	const widthOf = (label: string) =>
		Math.min(
			BADGE_MAX_WIDTH,
			Math.max(BADGE_MIN_WIDTH, Math.ceil(measure.measureText(label).width) + BADGE_PADDING_X * 2),
		);

	const rows: Badge[][] = [];
	lines.forEach((line, index) => {
		if (index % MAX_LINE_BADGES === 0) rows.push([]);
		rows.at(-1)!.push({
			label: line.number,
			color: line.color ?? DEFAULT_COLOR,
			textColor: line.textColor ?? DEFAULT_TEXT_COLOR,
		});
	});
	if (more > 0) rows[0]!.push({ label: `+${more}`, color: MORE_COLOR, textColor: MORE_TEXT_COLOR, more: true });

	const layout = rows.flatMap((row, rowIndex) => {
		let x = OUTLINE_WIDTH;
		return row.map((badge) => {
			const width = widthOf(badge.label);
			const box = { ...badge, x, y: OUTLINE_WIDTH + rowIndex * (LINE_BADGES_HEIGHT + BADGE_GAP), width };
			x += width + BADGE_GAP;
			return box;
		});
	});

	const width = Math.max(...layout.map(({ x, width }) => x + width)) + OUTLINE_WIDTH;
	const height = rows.length * LINE_BADGES_HEIGHT + (rows.length - 1) * BADGE_GAP;

	const canvas = document.createElement("canvas");
	canvas.width = Math.ceil(width * scale);
	canvas.height = Math.ceil(height * scale);

	const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
	ctx.scale(scale, scale);
	ctx.font = LINE_BADGES_FONT;
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";

	const imageId = lineBadgesImageId(lineBadges);
	moreBadgeBoxes.delete(imageId);

	for (const { label, color, textColor, more: isMore, x, y, width: badgeWidth } of layout) {
		ctx.fillStyle = OUTLINE_COLOR;
		ctx.beginPath();
		ctx.roundRect(
			x - OUTLINE_WIDTH,
			y - OUTLINE_WIDTH,
			badgeWidth + OUTLINE_WIDTH * 2,
			LINE_BADGES_HEIGHT,
			BADGE_RADIUS + OUTLINE_WIDTH,
		);
		ctx.fill();

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.roundRect(x, y, badgeWidth, LINE_BADGE_HEIGHT, BADGE_RADIUS);
		ctx.fill();

		ctx.fillStyle = textColor;
		ctx.fillText(
			fitLabel(ctx, label, badgeWidth - BADGE_PADDING_X * 2),
			x + badgeWidth / 2,
			y + (LINE_BADGE_HEIGHT + capHeight) / 2,
		);

		if (isMore) {
			moreBadgeBoxes.set(imageId, {
				x: x - OUTLINE_WIDTH,
				y: y - OUTLINE_WIDTH,
				width: badgeWidth + OUTLINE_WIDTH * 2,
				height: LINE_BADGES_HEIGHT,
			});
		}
	}

	return {
		image: ctx.getImageData(0, 0, canvas.width, canvas.height),
		pixelRatio: scale,
	};
}
