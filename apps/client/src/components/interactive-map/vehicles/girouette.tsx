import { clsx } from "clsx";
import { type ComponentPropsWithoutRef, useEffect, useState } from "react";
import { match } from "ts-pattern";

const paneBgColor = "#1D1D1B";

const fontProperties = {
	// Hanover Graphic fonts
	"0808B2E1": { height: 8, spacing: 1, extraSpacing: false },
	"1310C2E1": { height: 13, spacing: 2, extraSpacing: false },
	"1508C2E1": { height: 15, spacing: 2, extraSpacing: false },
	"1510N2E1": { height: 15, spacing: 2, extraSpacing: false },
	"1513B3E1": { height: 15, spacing: 2, extraSpacing: false },
	// Hanover Super-X fonts
	"0505SUPX": { height: 5, spacing: 1, extraSpacing: true },
	"1107SUPX": { height: 11, spacing: 1, extraSpacing: true },
	"1407SUPX": { height: 14, spacing: 1, extraSpacing: true },
	"1507SUPX": { height: 15, spacing: 1, extraSpacing: true },
	"1508SUPX": { height: 15, spacing: 1, extraSpacing: true },
	"1710SUPX": { height: 17, spacing: 2, extraSpacing: true },
	// Lumiplan/Duhamel fonts
	"14LUPLAN": { height: 14, spacing: 1, extraSpacing: false },
	"LUMIPLAN-2": { height: 8, spacing: 1, extraSpacing: false },
	"LUMIPLAN-A": { height: 16, spacing: 1, extraSpacing: false },
	"DUHAMEL-24-22-2": { height: 22, spacing: 2, extraSpacing: false },
	// Special fonts
	METRO: { height: 16, spacing: 0, extraSpacing: false },
	"1510N2E1-TCAR": { height: 15, spacing: 2, extraSpacing: false },
} as const;

type Font = keyof typeof fontProperties;
type TextSpacing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const ledColors = {
	YELLOW: "#FF8000",
	WHITE: "#F2FBFF",
} as const;
type LedColor = keyof typeof ledColors;

type GirouetteDimensions = {
	height: number;
	rnWidth: number;
	destinationWidth: number;
};
const defaultDimensions: GirouetteDimensions = {
	height: 17,
	rnWidth: 32,
	destinationWidth: 160,
};

export type RouteNumberData = {
	text: string;
	//- Font & spacing
	font?: Font;
	scroll?: boolean;
	spacing?: TextSpacing;
	//- Colors
	backgroundColor?: string;
	outlineColor?: string;
	textColor?: string;
	halfPattern?: "tl" | "tr" | "bl" | "br";
};

type PageLine = {
	font?: Font;
	scroll?: boolean;
	spacing?: number;
	text: string;
};

type PagesData = PageLine | [PageLine, PageLine];

export type GirouetteData = {
	dimensions?: GirouetteDimensions;
	ledColor?: "YELLOW" | "WHITE";
	routeNumber?: RouteNumberData;
	pages?: PagesData[];
	width?: number;
};

type GirouetteProps = ComponentPropsWithoutRef<"div"> &
	GirouetteData & {
		width: number;
	};

export function Girouette({
	className,
	dimensions = defaultDimensions,
	ledColor = "WHITE",
	pages = [],
	routeNumber = { text: "" },
	width,
	...props
}: Readonly<GirouetteProps>) {
	return (
		<div
			className={clsx("flex border-white", className)}
			style={{
				aspectRatio: (dimensions.rnWidth + dimensions.destinationWidth) / dimensions.height,
				backgroundColor: paneBgColor,
				width: `${width}px`,
			}}
			{...props}
		>
			<RouteNumber dimensions={dimensions} ledColor={ledColor} routeNumber={routeNumber} width={width} />
			<Pages dimensions={dimensions} ledColor={ledColor} pages={pages} width={width} />
		</div>
	);
}

// ---

type RouteNumberProps = {
	dimensions: GirouetteDimensions;
	ledColor: LedColor;
	routeNumber: RouteNumberData;
	width: number;
};

function RouteNumber({ dimensions, ledColor, routeNumber, width }: Readonly<RouteNumberProps>) {
	const [halfPattern, setHalfPattern] = useState<RouteNumberData["halfPattern"]>();

	useEffect(() => {
		if (typeof routeNumber.halfPattern === "undefined") return;

		let showingHalfPattern = false;

		const interval = setInterval(() => {
			setHalfPattern(showingHalfPattern ? undefined : routeNumber.halfPattern);
			showingHalfPattern = !showingHalfPattern;
		}, 1500);

		return () => clearInterval(interval);
	}, [routeNumber.halfPattern]);

	if (typeof routeNumber === "undefined") return null;

	const fontFamily = routeNumber.font ?? "1513B3E1";
	const height = (dimensions.height * width) / (dimensions.rnWidth + dimensions.destinationWidth);
	const onePixel = width / (dimensions.rnWidth + dimensions.destinationWidth);
	const spacing =
		onePixel * (routeNumber.spacing ?? fontProperties[fontFamily].spacing) +
		onePixel * (fontProperties[fontFamily].extraSpacing && routeNumber.outlineColor ? 2 : 0);
	const virtualHeight = (height / dimensions.height) * fontProperties[fontFamily].height;
	return (
		<div
			className={clsx("flex items-center justify-center overflow-hidden whitespace-nowrap")}
			style={{
				width: `${onePixel * dimensions.rnWidth}px`,
				//- Font, placement & spacing
				fontFamily: `"${fontFamily}"`,
				fontSize: `${virtualHeight}px`,
				letterSpacing: `${spacing}px`,
				lineHeight: `${virtualHeight}px`,
				paddingLeft: `${spacing}px`,
				//- Colors
				...(halfPattern
					? {
							background: `linear-gradient(to ${match(halfPattern)
								.with("tl", () => "top left")
								.with("tr", () => "top right")
								.with("bl", () => "bottom left")
								.with("br", () => "bottom right")
								.exhaustive()}, ${routeNumber.backgroundColor ?? paneBgColor} 50%, ${paneBgColor} 50%)`,
						}
					: { backgroundColor: routeNumber.backgroundColor ?? paneBgColor }),
				color: routeNumber.textColor ?? ledColors[ledColor],
				//- Outline (if applicable)
				...(routeNumber.outlineColor
					? {
							textShadow: `
                ${onePixel}px 0px 0 ${routeNumber.outlineColor},
                -${onePixel}px 0px 0 ${routeNumber.outlineColor},
                0px ${onePixel}px 0 ${routeNumber.outlineColor},
                0px -${onePixel}px 0 ${routeNumber.outlineColor}`,
						}
					: {}),
			}}
		>
			<span
				className={clsx({ "animate-route-number": routeNumber.scroll })}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: ain't coming from user input
				dangerouslySetInnerHTML={{
					__html: routeNumber.text.trimEnd().replaceAll(" ", "&nbsp;"),
				}}
			/>
		</div>
	);
}

// ---

type PagesProps = {
	dimensions: GirouetteDimensions;
	ledColor: LedColor;
	pages: PagesData[];
	width: number;
};

function Pages({ dimensions, ledColor, pages, width }: Readonly<PagesProps>) {
	const [currentPageIndex, setCurrentPageIndex] = useState(0);
	useEffect(() => {
		const nextPage = () => {
			setCurrentPageIndex((i) => (i < pages.length - 1 ? i + 1 : 0));
		};
		const interval = setInterval(nextPage, 3000);
		return () => clearInterval(interval);
	}, [pages]);

	const activePage = pages[currentPageIndex];
	if (typeof activePage === "undefined") return null;

	const lines = Array.isArray(activePage) ? activePage : [activePage];
	const oneLine = lines.length === 1;

	const height = (dimensions.height * width) / (dimensions.rnWidth + dimensions.destinationWidth);
	const onePixel = width / (dimensions.rnWidth + dimensions.destinationWidth);

	return (
		<div
			className="flex flex-col items-center overflow-hidden"
			style={{
				color: ledColors[ledColor],
				width: `${onePixel * dimensions.destinationWidth}px`,
				//- Lines alignment
				justifyContent: lines.length === 1 ? "center" : "space-between",
			}}
		>
			{lines.filter(Boolean).map((line) => {
				const fontFamily = line.font ?? (oneLine ? "1513B3E1" : "0808B2E1");
				const spacing = onePixel * (line.spacing ?? fontProperties[fontFamily].spacing);
				const virtualHeight = (height / dimensions.height) * fontProperties[fontFamily].height;
				const processedText = line.text.trimEnd().replaceAll(" ", "&nbsp;");
				return (
					<span
						className={clsx("overflow-hidden whitespace-nowrap", {
							"animate-page": line.scroll,
						})}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: ain't coming from user input
						dangerouslySetInnerHTML={{ __html: processedText }}
						key={line.text}
						style={{
							//- Font, placement & spacing
							fontFamily: `"${fontFamily}"`,
							fontSize: `${virtualHeight}px`,
							letterSpacing: `${spacing}px`,
							lineHeight: `${virtualHeight}px`,
							paddingLeft: `${spacing}px`,
						}}
					/>
				);
			})}
		</div>
	);
}
