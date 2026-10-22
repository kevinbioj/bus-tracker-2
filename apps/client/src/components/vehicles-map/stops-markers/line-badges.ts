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

export type LineBadges = { lines: Line[]; more: number };

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

export function createLineBadges({ lines, more }: LineBadges) {
	const scale = window.devicePixelRatio;
	const measure = getMeasureContext();

	const capHeight = measure.measureText("H").actualBoundingBoxAscent;

	const badges = lines.map((line) => ({
		label: line.number,
		color: line.color ?? DEFAULT_COLOR,
		textColor: line.textColor ?? DEFAULT_TEXT_COLOR,
	}));
	if (more > 0) badges.push({ label: `+${more}`, color: MORE_COLOR, textColor: MORE_TEXT_COLOR });

	const widths = badges.map(({ label }) =>
		Math.min(
			BADGE_MAX_WIDTH,
			Math.max(BADGE_MIN_WIDTH, Math.ceil(measure.measureText(label).width) + BADGE_PADDING_X * 2),
		),
	);
	const width = widths.reduce((total, badgeWidth) => total + badgeWidth, 0) + BADGE_GAP * (badges.length - 1);

	const canvas = document.createElement("canvas");
	canvas.width = Math.ceil((width + OUTLINE_WIDTH * 2) * scale);
	canvas.height = Math.ceil(LINE_BADGES_HEIGHT * scale);

	const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
	ctx.scale(scale, scale);
	ctx.font = LINE_BADGES_FONT;
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";

	let x = OUTLINE_WIDTH;
	badges.forEach(({ label, color, textColor }, index) => {
		const badgeWidth = widths[index]!;

		ctx.fillStyle = OUTLINE_COLOR;
		ctx.beginPath();
		ctx.roundRect(
			x - OUTLINE_WIDTH,
			0,
			badgeWidth + OUTLINE_WIDTH * 2,
			LINE_BADGES_HEIGHT,
			BADGE_RADIUS + OUTLINE_WIDTH,
		);
		ctx.fill();

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.roundRect(x, OUTLINE_WIDTH, badgeWidth, LINE_BADGE_HEIGHT, BADGE_RADIUS);
		ctx.fill();

		ctx.fillStyle = textColor;
		ctx.fillText(
			fitLabel(ctx, label, badgeWidth - BADGE_PADDING_X * 2),
			x + badgeWidth / 2,
			OUTLINE_WIDTH + (LINE_BADGE_HEIGHT + capHeight) / 2,
		);

		x += badgeWidth + BADGE_GAP;
	});

	return {
		image: ctx.getImageData(0, 0, canvas.width, canvas.height),
		pixelRatio: scale,
	};
}
