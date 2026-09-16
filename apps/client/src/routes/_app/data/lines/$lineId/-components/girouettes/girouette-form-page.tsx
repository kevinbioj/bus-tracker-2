import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowDownIcon,
	ArrowLeftRightIcon,
	ArrowUpIcon,
	BrushIcon,
	ChevronsLeftRightIcon,
	ChevronsRightLeftIcon,
	FastForwardIcon,
	InfoIcon,
	PaletteIcon,
	PlusIcon,
	TrashIcon,
	TypeIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useSnackbar } from "notistack";
import type { ReactNode } from "react";
import { useState } from "react";
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useWindowSize } from "usehooks-ts";
import { z } from "zod";

import {
	CreateGirouetteMutation,
	GetLineGirouettesQuery,
	type Girouette,
	type GirouetteInput,
	UpdateGirouetteMutation,
} from "~/api/girouettes";
import { GetLineOnlineDestinationsQuery, GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { ColorPicker } from "~/components/ui/color-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import {
	type GirouetteData,
	Girouette as GirouettePreview,
	getAutoOutlineColor,
	isBitmapPage,
	type TextSpacing,
} from "~/components/vehicles-map/vehicles-markers/popup/girouette";
import {
	createBitmap,
	type GirouetteBitmap,
	resizeBitmap,
} from "~/components/vehicles-map/vehicles-markers/popup/girouette-bitmap";
import * as m from "~/paraglide/messages";
import { DataPageLayout, LineBreadcrumbLabel } from "~/routes/_app/data/-components/data-page-layout";
import { cn } from "~/utils/cn";
import { BitmapEditorDialog } from "./bitmap-editor";
import {
	ALL_FONTS,
	type AllowedFont,
	DEFAULT_FONT_VARIANT,
	DUAL_LINE_FONTS,
	getFontLabel,
	getFontsForDualLine,
	getLine1FontForDualLine,
} from "./font-config";

const lineSchema = z.object({
	text: z.string(),
	fontVariant: z.string(),
	flash: z.boolean(),
	scroll: z.boolean(),
	inverted: z.boolean(),
	spacing: z.number().int().min(0).max(10).nullable(),
});

const bitmapSchema = z.object({
	width: z.number().int().nonnegative(),
	height: z.number().int().nonnegative(),
	palette: z.array(z.string()),
	rows: z.array(z.string()),
});

/**
 * A pane is authored either as text — with a font, a spacing and the usual
 * effects — or freely drawn pixel by pixel. Both are kept side by side in the
 * form so that switching back and forth never loses what was entered.
 */
const paneModeSchema = z.enum(["text", "bitmap"]);

const pageSchema = z.object({
	mode: paneModeSchema,
	lines: z.array(lineSchema).min(1).max(2),
	bitmap: bitmapSchema.nullable(),
	/** Blinking of a drawn page; the text lines carry their own. */
	flash: z.boolean(),
	/** Describes a drawn page, for assistive technologies and older clients. */
	altText: z.string(),
});

const dimensionsSchema = z.object({
	height: z.number().int().positive(),
	rnWidth: z.number().int().nonnegative(),
	destinationWidth: z.number().int().positive(),
});

const formSchema = z
	.object({
		directionId: z.string().nullable(),
		/** Matrix of the girouette when it isn't one this form derives on its own. */
		dimensions: dimensionsSchema.nullable(),
		destinations: z.array(z.string()),
		routeNumber: z.object({
			mode: paneModeSchema,
			bitmap: bitmapSchema.nullable(),
			altText: z.string(),
			text: z.string(),
			fontVariant: z.string(),
			textColor: z.string(),
			backgroundColor: z.string(),
			outlineColor: z.string(),
			flash: z.boolean(),
			scroll: z.boolean(),
			spacing: z.number().int().min(0).max(10).nullable(),
			halfPattern: z.enum(["tl", "tr", "bl", "br"]).nullable(),
		}),
		pages: z.array(pageSchema).min(1).max(10),
	})
	.superRefine((values, ctx) => {
		// A drawing carries no text of its own: without that description it is mute to
		// a screen reader, and blank on a client that can't display a drawn pane.
		if (values.routeNumber.mode === "bitmap" && values.routeNumber.altText.trim() === "") {
			ctx.addIssue({
				code: "custom",
				path: ["routeNumber", "altText"],
				message: m.line_girouettes_form_alt_text_required(),
			});
		}
		values.pages.forEach((page, index) => {
			if (page.mode === "bitmap" && page.altText.trim() === "") {
				ctx.addIssue({
					code: "custom",
					path: ["pages", index, "altText"],
					message: m.line_girouettes_form_alt_text_required(),
				});
			}
		});
	});

type FormValues = z.infer<typeof formSchema>;

const defaultLine = (fontVariant = DEFAULT_FONT_VARIANT): FormValues["pages"][number]["lines"][number] => ({
	text: "",
	fontVariant,
	flash: false,
	scroll: false,
	inverted: false,
	spacing: null,
});

const defaultPage = (): FormValues["pages"][number] => ({
	mode: "text",
	lines: [defaultLine()],
	bitmap: null,
	flash: false,
	altText: "",
});

/**
 * Font the description of a drawn pane is written with. It is only ever rendered
 * by a client that can't display the drawing, so it is fixed here rather than
 * left to a choice that would have no visible effect while editing.
 */
const ALT_TEXT_FONT: AllowedFont = "1407SUPX";

/** Matrix dimensions of a girouette pane, in pixels. */
const PANE_HEIGHT = 17;
const ROUTE_NUMBER_WIDTH = 32;
const DESTINATION_WIDTH = 160;
/** Width the destination pane takes over once the route number block collapses. */
const FULL_WIDTH = 192;

type Dimensions = { height: number; rnWidth: number; destinationWidth: number };

const DEFAULT_DIMENSIONS: Dimensions = {
	height: PANE_HEIGHT,
	rnWidth: ROUTE_NUMBER_WIDTH,
	destinationWidth: DESTINATION_WIDTH,
};
const COLLAPSED_DIMENSIONS: Dimensions = { height: PANE_HEIGHT, rnWidth: 0, destinationWidth: FULL_WIDTH };

/**
 * Whether the form derives those dimensions on its own. Any other matrix — a
 * taller panel, a wider route number block — comes from somewhere else and is
 * carried through untouched, instead of being flattened to the usual 17×192.
 */
function isDerivedDimensions(dimensions: Dimensions) {
	return [DEFAULT_DIMENSIONS, COLLAPSED_DIMENSIONS].some(
		(candidate) =>
			candidate.height === dimensions.height &&
			candidate.rnWidth === dimensions.rnWidth &&
			candidate.destinationWidth === dimensions.destinationWidth,
	);
}

/**
 * Builds the form values from an existing girouette. When duplicating, everything
 * is copied but the matching criteria (direction and destinations), which must be
 * filled in again so that the copy doesn't compete with its source.
 */
const defaultValues = (girouette?: Girouette, duplicate = false): FormValues => {
	if (!girouette) {
		return {
			directionId: null,
			dimensions: null,
			destinations: [],
			routeNumber: {
				mode: "text",
				bitmap: null,
				altText: "",
				text: "",
				fontVariant: DEFAULT_FONT_VARIANT,
				textColor: "",
				backgroundColor: "",
				outlineColor: "",
				flash: false,
				scroll: false,
				spacing: null,
				halfPattern: null,
			},
			pages: [defaultPage()],
		};
	}

	const d = girouette.data;

	return {
		directionId: duplicate || girouette.directionId === null ? null : String(girouette.directionId),
		// Kept verbatim when the girouette doesn't use one of the two matrices this
		// form knows how to derive, so that editing it doesn't resize the panel.
		dimensions: d.dimensions != null && !isDerivedDimensions(d.dimensions) ? d.dimensions : null,
		destinations: duplicate ? [] : girouette.destinations,
		routeNumber: {
			mode: d.routeNumber?.bitmap !== undefined ? "bitmap" : "text",
			bitmap: d.routeNumber?.bitmap ?? null,
			// A drawn pane stores its description where a text pane stores its text.
			altText: d.routeNumber?.bitmap !== undefined ? (d.routeNumber.text ?? "") : "",
			text: d.routeNumber?.bitmap !== undefined ? "" : (d.routeNumber?.text ?? ""),
			fontVariant: d.routeNumber?.font ?? DEFAULT_FONT_VARIANT,
			textColor: d.routeNumber?.textColor ?? "",
			backgroundColor: d.routeNumber?.backgroundColor ?? "",
			outlineColor: d.routeNumber?.outlineColor ?? "",
			flash: d.routeNumber?.flash ?? false,
			scroll: d.routeNumber?.scroll ?? false,
			spacing: d.routeNumber?.spacing ?? null,
			halfPattern: d.routeNumber?.halfPattern ?? null,
		},
		pages:
			(d.pages ?? []).length > 0
				? (d.pages ?? []).map((page) => {
						if (isBitmapPage(page)) {
							return {
								mode: "bitmap" as const,
								lines: [defaultLine()],
								bitmap: page.bitmap,
								flash: page.flash ?? false,
								altText: page.text ?? "",
							};
						}
						const rawLines = Array.isArray(page) ? page : [page];
						return {
							mode: "text" as const,
							bitmap: null,
							flash: false,
							altText: "",
							lines: rawLines.map((line) => ({
								text: line.text,
								fontVariant: line.font ?? DEFAULT_FONT_VARIANT,
								flash: line.flash ?? false,
								scroll: line.scroll ?? false,
								inverted: line.inverted ?? false,
								spacing: line.spacing ?? null,
							})),
						};
					})
				: [defaultPage()],
	};
};

type RouteNumberShape = { mode?: "text" | "bitmap"; text?: string; backgroundColor?: string };

/**
 * A route number with neither text nor background color displays nothing: its
 * whole width goes to the destination block. A drawn route number always keeps
 * its block, as an empty drawing is a deliberate choice rather than a blank.
 */
/** Whether the route number block of that matrix has any room to be drawn on. */
function isDrawableRouteNumber(custom?: Dimensions | null) {
	return custom == null || custom.rnWidth > 0;
}

function paneDimensions(routeNumber: RouteNumberShape, custom?: Dimensions | null): Dimensions {
	if (custom != null) return custom;
	const isRouteNumberEmpty =
		routeNumber.mode !== "bitmap" && (routeNumber.text ?? "").trim() === "" && !routeNumber.backgroundColor;
	return isRouteNumberEmpty ? COLLAPSED_DIMENSIONS : DEFAULT_DIMENSIONS;
}

/** Girouettes that don't carry dimensions keep the renderer's default 32/160 split. */
function girouetteDimensions(routeNumber: RouteNumberShape, custom?: Dimensions | null): GirouetteData["dimensions"] {
	if (custom != null) return custom;
	const dimensions = paneDimensions(routeNumber);
	return dimensions.rnWidth === 0 ? dimensions : undefined;
}

/** Drawing of a pane, fitted to it and blank when the pane was never drawn on. */
function paneBitmap(bitmap: GirouetteBitmap | null | undefined, width: number, height: number): GirouetteBitmap {
	return bitmap == null ? createBitmap(width, height) : resizeBitmap(bitmap, width, height);
}

function formToGirouetteInput(values: FormValues, enabled = true): GirouetteInput {
	type PageLine = {
		font?: AllowedFont;
		flash?: boolean;
		scroll?: boolean;
		inverted?: boolean;
		spacing?: TextSpacing;
		text: string;
	};

	const routeNumberMode =
		values.routeNumber.mode === "bitmap" && isDrawableRouteNumber(values.dimensions) ? "bitmap" : "text";
	const routeNumberShape: RouteNumberShape = {
		mode: routeNumberMode,
		text: values.routeNumber.text,
		backgroundColor: values.routeNumber.backgroundColor || undefined,
	};
	const dimensions = paneDimensions(routeNumberShape, values.dimensions);

	const data: GirouetteData = {
		dimensions: girouetteDimensions(routeNumberShape, values.dimensions),
		ledColor: "WHITE",
		routeNumber:
			routeNumberMode === "bitmap"
				? {
						// Carried for the clients that can't display a drawing: they read the
						// pane as a text one, and scroll whatever doesn't fit.
						text: values.routeNumber.altText,
						font: ALT_TEXT_FONT,
						scroll: true,
						bitmap: paneBitmap(values.routeNumber.bitmap, dimensions.rnWidth, dimensions.height),
						flash: values.routeNumber.flash || undefined,
					}
				: {
						text: values.routeNumber.text,
						font: values.routeNumber.fontVariant as AllowedFont,
						textColor: values.routeNumber.textColor || undefined,
						backgroundColor: values.routeNumber.backgroundColor || undefined,
						outlineColor: values.routeNumber.outlineColor || undefined,
						flash: values.routeNumber.flash || undefined,
						scroll: values.routeNumber.scroll || undefined,
						spacing: (values.routeNumber.spacing ?? undefined) as TextSpacing | undefined,
						halfPattern: values.routeNumber.halfPattern ?? undefined,
					},
		pages: values.pages.map((page) => {
			if (page.mode === "bitmap") {
				return {
					bitmap: paneBitmap(page.bitmap, dimensions.destinationWidth, dimensions.height),
					flash: page.flash || undefined,
					// Fallback for the clients that don't know how to display a drawing:
					// they read the page as a text one, and a missing text crashes them.
					text: page.altText,
					font: ALT_TEXT_FONT,
					scroll: true,
				};
			}
			const lines: PageLine[] = page.lines.map((line) => ({
				text: line.text,
				font: line.fontVariant as AllowedFont,
				flash: line.flash || undefined,
				scroll: line.scroll || undefined,
				inverted: line.inverted || undefined,
				spacing: (line.spacing ?? undefined) as TextSpacing | undefined,
			}));
			return lines.length === 2 ? (lines as unknown as [PageLine, PageLine]) : lines[0];
		}) as GirouetteData["pages"],
	};

	return {
		directionId: values.directionId !== null ? Number(values.directionId) : null,
		destinations: values.destinations,
		data,
		enabled,
	};
}

type GirouetteFormPageProps = {
	lineId: number;
	girouetteId?: number;
	/** Creation mode only: girouette whose appearance is used as a starting point. */
	duplicateFromId?: number;
};

export function GirouetteFormPage({ lineId, girouetteId, duplicateFromId }: Readonly<GirouetteFormPageProps>) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const snackbar = useSnackbar();
	const { width } = useWindowSize();

	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { data: girouettes } = useSuspenseQuery(GetLineGirouettesQuery(lineId));

	const girouette = girouetteId !== undefined ? girouettes.find((g) => g.id === girouetteId) : undefined;
	const duplicatedGirouette =
		girouette === undefined && duplicateFromId !== undefined
			? girouettes.find((g) => g.id === duplicateFromId)
			: undefined;

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: defaultValues(girouette ?? duplicatedGirouette, duplicatedGirouette !== undefined),
	});

	const { fields: pageFields, append, remove, move } = useFieldArray({ control: form.control, name: "pages" });
	const [newDest, setNewDest] = useState("");
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);

	// Page cycling of the preview: automatic by default, manual once one of the
	// arrows is used, and back to automatic through the "A" button.
	const [autoPages, setAutoPages] = useState(true);
	const [previewPageIndex, setPreviewPageIndex] = useState(0);
	const goToPage = (delta: number) => {
		setAutoPages(false);
		setPreviewPageIndex((index) => index + delta);
	};
	// The renderer wraps the index around on its own and reports the wrapped one
	// back, but a click and a page removal both leave it out of bounds for a render.
	const displayedPageNumber =
		pageFields.length > 0 ? (((previewPageIndex % pageFields.length) + pageFields.length) % pageFields.length) + 1 : 0;

	const watchedDestinations = useWatch({ control: form.control, name: "destinations" }) ?? [];

	const { data: onlineDestinations } = useQuery(GetLineOnlineDestinationsQuery(line.id));
	const destinationSuggestions = (onlineDestinations ?? []).filter(
		(destination) =>
			!watchedDestinations.includes(destination) && destination.toLowerCase().includes(newDest.trim().toLowerCase()),
	);

	const handleAddDestination = (destination = newDest) => {
		const trimmed = destination.trim();
		if (!trimmed || watchedDestinations.includes(trimmed)) return;
		form.setValue("destinations", [...watchedDestinations, trimmed]);
		setNewDest("");
		setSuggestionsOpen(false);
	};

	const handleRemoveDestination = (index: number) => {
		form.setValue(
			"destinations",
			watchedDestinations.filter((_, i) => i !== index),
		);
	};

	const handleSwapRouteColors = () => {
		const textColor = form.getValues("routeNumber.textColor");
		const backgroundColor = form.getValues("routeNumber.backgroundColor");
		form.setValue("routeNumber.textColor", backgroundColor, { shouldDirty: true });
		form.setValue("routeNumber.backgroundColor", textColor, { shouldDirty: true });
	};

	const handleApplyLineColors = () => {
		const withHash = (color: string) => (color ? (color.startsWith("#") ? color : `#${color}`) : "");
		const backgroundColor = withHash(line.color);
		const textColor = withHash(line.textColor);
		form.setValue("routeNumber.backgroundColor", backgroundColor, { shouldDirty: true });
		form.setValue("routeNumber.textColor", textColor, { shouldDirty: true });
		form.setValue("routeNumber.outlineColor", getAutoOutlineColor(textColor || null, backgroundColor || null) ?? "", {
			shouldDirty: true,
		});
	};

	const backToList = () => navigate({ to: "/data/lines/$lineId/girouettes", params: { lineId: String(lineId) } });

	const createMutation = useMutation({
		...CreateGirouetteMutation(lineId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lines", lineId, "girouettes"] });
			snackbar.enqueueSnackbar(m.line_girouettes_create_success(), { variant: "success" });
			backToList();
		},
		onError: () => snackbar.enqueueSnackbar(m.line_girouettes_error(), { variant: "error" }),
	});

	const updateMutation = useMutation({
		...UpdateGirouetteMutation(girouette?.id ?? 0),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lines", lineId, "girouettes"] });
			snackbar.enqueueSnackbar(m.line_girouettes_update_success(), { variant: "success" });
			backToList();
		},
		onError: () => snackbar.enqueueSnackbar(m.line_girouettes_error(), { variant: "error" }),
	});

	const onSubmit = (values: FormValues) => {
		// A destination still sitting in the input field was never validated: take it anyway.
		const pendingDestination = newDest.trim();
		const destinations =
			pendingDestination && !values.destinations.includes(pendingDestination)
				? [...values.destinations, pendingDestination]
				: values.destinations;

		if (destinations !== values.destinations) {
			form.setValue("destinations", destinations);
			setNewDest("");
		}

		// A copy inherits the enabled state of its source, like the rest of its settings.
		const input = formToGirouetteInput(
			{ ...values, destinations },
			girouette?.enabled ?? duplicatedGirouette?.enabled ?? true,
		);
		if (girouette) updateMutation.mutate(input);
		else createMutation.mutate(input);
	};

	/**
	 * A long form scrolls the offending field into view on its own, but nothing
	 * else would tell why the save didn't happen: the reason is named out loud.
	 */
	const onInvalid = (errors: FieldErrors<FormValues>) => {
		// Field arrays report their errors as a sparse array carrying a `root` entry,
		// so the array branch is narrowed before being walked.
		const pageErrors = Array.isArray(errors.pages) ? errors.pages : [];
		const missesAltText =
			errors.routeNumber?.altText !== undefined || pageErrors.some((page) => page?.altText !== undefined);
		snackbar.enqueueSnackbar(
			missesAltText ? m.line_girouettes_form_alt_text_required() : m.line_girouettes_form_invalid(),
			{ variant: "error" },
		);
	};

	const watchedValues = useWatch({ control: form.control });
	const customDimensions = (watchedValues.dimensions as Dimensions | undefined) ?? null;
	// A panel whose own matrix gives the route number block no width at all has
	// nothing to draw on: the block stays text-only there.
	const isRouteNumberDrawable = isDrawableRouteNumber(customDimensions);
	const routeNumberMode = (isRouteNumberDrawable ? watchedValues.routeNumber?.mode : "text") ?? "text";

	const previewShape: RouteNumberShape = {
		mode: routeNumberMode,
		text: watchedValues.routeNumber?.text,
		backgroundColor: watchedValues.routeNumber?.backgroundColor || undefined,
	};
	const previewDimensions = paneDimensions(previewShape, customDimensions);
	const previewData: GirouetteData = {
		dimensions: girouetteDimensions(previewShape, customDimensions),
		ledColor: "WHITE",
		routeNumber:
			routeNumberMode === "bitmap"
				? {
						text: watchedValues.routeNumber?.altText ?? "",
						bitmap: paneBitmap(
							(watchedValues.routeNumber?.bitmap as GirouetteBitmap | null) ?? null,
							previewDimensions.rnWidth,
							previewDimensions.height,
						),
						flash: watchedValues.routeNumber?.flash || undefined,
					}
				: watchedValues.routeNumber
					? {
							text: watchedValues.routeNumber.text ?? "",
							font: (watchedValues.routeNumber.fontVariant as AllowedFont) ?? DEFAULT_FONT_VARIANT,
							textColor: watchedValues.routeNumber.textColor || undefined,
							backgroundColor: watchedValues.routeNumber.backgroundColor || undefined,
							outlineColor: watchedValues.routeNumber.outlineColor || undefined,
							flash: watchedValues.routeNumber.flash || undefined,
							scroll: watchedValues.routeNumber.scroll || undefined,
							spacing: (watchedValues.routeNumber.spacing ?? undefined) as TextSpacing | undefined,
							halfPattern: watchedValues.routeNumber.halfPattern ?? undefined,
						}
					: { text: "" },
		pages: (watchedValues.pages ?? []).map((page) => {
			if (page?.mode === "bitmap") {
				return {
					bitmap: paneBitmap(
						page.bitmap as GirouetteBitmap | null,
						previewDimensions.destinationWidth,
						previewDimensions.height,
					),
					flash: page.flash || undefined,
					text: page.altText ?? "",
				};
			}
			const lines = (page?.lines ?? []).map((line) => ({
				text: line?.text ?? "",
				font: (line?.fontVariant as AllowedFont) ?? DEFAULT_FONT_VARIANT,
				flash: line?.flash || undefined,
				scroll: line?.scroll || undefined,
				inverted: line?.inverted || undefined,
				spacing: line?.spacing ?? undefined,
			}));
			return lines.length === 2
				? (lines as unknown as [{ text: string; font: AllowedFont }, { text: string; font: AllowedFont }])
				: (lines[0] ?? { text: "" });
		}) as GirouetteData["pages"],
	};

	const isPending = createMutation.isPending || updateMutation.isPending;
	const title =
		girouette !== undefined
			? m.line_girouettes_form_edit_title()
			: duplicatedGirouette !== undefined
				? m.line_girouettes_form_duplicate_title()
				: m.line_girouettes_form_create_title();

	return (
		<DataPageLayout
			current={title}
			breadcrumbMiddle={[
				{
					label: <LineBreadcrumbLabel line={line} />,
					to: "/data/lines/$lineId",
					params: { lineId: String(lineId) },
				},
				{
					label: m.line_girouettes_breadcrumb(),
					to: "/data/lines/$lineId/girouettes",
					params: { lineId: String(lineId) },
				},
			]}
			network={network}
			networkSearch={{ tab: "lines" }}
			title={m.line_girouettes_page_title({ lineNumber: line.number, networkName: network.name })}
		>
			<div className="sticky top-14 z-10 bg-background mt-4 pb-3 border-b flex flex-col gap-2">
				<p className="text-sm font-semibold pt-1">{m.line_girouettes_form_preview_title()}</p>
				<div className="flex items-center gap-1.5 overflow-x-auto">
					<GirouettePreview
						className="border border-[#444444]"
						onPageIndexChange={setPreviewPageIndex}
						pageIndex={autoPages ? undefined : previewPageIndex}
						width={Math.min(width - 92, 512)}
						{...previewData}
					/>
					<div className="flex shrink-0 items-center gap-1">
						{/* Both arrows form a single vertical block: only the outer corners stay
						    rounded, and the lower button climbs over the border of the upper one. */}
						<div className="flex flex-col">
							<Button
								className="rounded-b-none"
								type="button"
								variant="outline"
								size="icon-sm"
								title={m.line_girouettes_form_preview_previous_page()}
								disabled={pageFields.length <= 1}
								onClick={() => goToPage(-1)}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								className="-mt-px rounded-t-none"
								type="button"
								variant="outline"
								size="icon-sm"
								title={m.line_girouettes_form_preview_next_page()}
								disabled={pageFields.length <= 1}
								onClick={() => goToPage(1)}
							>
								<ArrowDownIcon />
							</Button>
						</div>
						<div className="flex flex-col items-center">
							<span className="mb-2.5 w-8 shrink-0 text-center text-xs tabular-nums text-muted-foreground select-none">
								{displayedPageNumber}/{pageFields.length}
							</span>
							<Button
								type="button"
								variant={autoPages ? "branding-default" : "outline"}
								size="icon-sm"
								title={m.line_girouettes_form_preview_auto_pages()}
								aria-pressed={autoPages}
								onClick={() => setAutoPages((auto) => !auto)}
							>
								A
							</Button>
						</div>
					</div>
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
				<div className="flex flex-col gap-4">
					<FormSection title={m.line_girouettes_form_identification_title()}>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
							<div className="grid gap-2 sm:w-44 sm:shrink-0">
								<Label>{m.line_girouettes_form_direction_label()}</Label>
								<Controller
									control={form.control}
									name="directionId"
									render={({ field }) => {
										const directionItems = [
											{ value: "none", label: m.line_girouettes_form_direction_any() },
											{ value: "0", label: m.line_girouettes_form_direction_outbound() },
											{ value: "1", label: m.line_girouettes_form_direction_inbound() },
										];
										return (
											<Select
												value={field.value ?? "none"}
												onValueChange={(v) => field.onChange(v === "none" ? null : v)}
												items={directionItems}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{directionItems.map((item) => (
														<SelectItem key={item.value} value={item.value}>
															{item.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										);
									}}
								/>
							</div>

							<div className="grid gap-2 min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<Label>{m.line_girouettes_form_destination_label()}</Label>
									<Tooltip>
										<TooltipTrigger
											render={
												<button className="text-muted-foreground hover:text-foreground" type="button">
													<InfoIcon className="size-3.5" />
												</button>
											}
										/>
										<TooltipContent className="shadow-xl">
											<ul className="list-disc list-outside pl-3.5 space-y-1 text-xs">
												<li>{m.line_girouettes_form_destination_hint_unknown()}</li>
												<li>{m.line_girouettes_form_destination_hint_replace()}</li>
											</ul>
										</TooltipContent>
									</Tooltip>
								</div>
								<div className="flex items-center gap-1.5">
									<div className="relative min-w-0 flex-1">
										<Input
											className="w-full"
											value={newDest}
											onChange={(e) => {
												setNewDest(e.target.value);
												setSuggestionsOpen(true);
											}}
											onFocus={() => setSuggestionsOpen(true)}
											onClick={() => setSuggestionsOpen(true)}
											onBlur={() => setSuggestionsOpen(false)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleAddDestination();
												} else if (e.key === "Escape") {
													setSuggestionsOpen(false);
												}
											}}
											placeholder={m.line_girouettes_form_destination_placeholder()}
										/>
										{suggestionsOpen && destinationSuggestions.length > 0 && (
											<ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
												{destinationSuggestions.map((destination) => (
													<li key={destination}>
														<button
															className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
															onMouseDown={(e) => e.preventDefault()}
															onClick={() => handleAddDestination(destination)}
															type="button"
														>
															{destination}
														</button>
													</li>
												))}
											</ul>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => handleAddDestination()}
										disabled={!newDest.trim() || watchedDestinations.includes(newDest.trim())}
									>
										<PlusIcon />
									</Button>
								</div>
								{watchedDestinations.length > 0 && (
									<div className="flex flex-wrap items-center gap-1.5">
										{watchedDestinations.map((dest, index) => (
											<span
												key={`${dest}-${
													// biome-ignore lint/suspicious/noArrayIndexKey: it's alright
													index
												}`}
												className="flex items-center gap-1 bg-muted rounded-md px-2 py-0.5 text-sm"
											>
												{dest}
												<button
													type="button"
													onClick={() => handleRemoveDestination(index)}
													className="text-muted-foreground hover:text-foreground"
												>
													<XIcon className="size-3" />
												</button>
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</FormSection>

					<FormSection title={m.line_girouettes_form_route_number_title()}>
						<div className="flex flex-col gap-4">
							{/* Same header bar as a destination page, so that both panes are
							    switched between text and drawing the same way. */}
							{isRouteNumberDrawable && (
								<div className="-mx-3 -mt-2 flex h-8 items-center justify-end border-y bg-muted/40 px-3">
									<PaneModeField compact form={form} name="routeNumber.mode" />
								</div>
							)}

							{routeNumberMode === "bitmap" && (
								<div className="flex flex-col gap-3">
									<Controller
										control={form.control}
										name="routeNumber.bitmap"
										render={({ field }) => (
											<BitmapEditorDialog
												height={previewDimensions.height}
												ledColor="WHITE"
												onChange={field.onChange}
												title={m.line_girouettes_form_route_number_title()}
												value={paneBitmap(
													field.value as GirouetteBitmap | null,
													previewDimensions.rnWidth,
													previewDimensions.height,
												)}
												width={previewDimensions.rnWidth}
											/>
										)}
									/>
									<AltTextField
										error={form.formState.errors.routeNumber?.altText?.message}
										form={form}
										name="routeNumber.altText"
									/>
									<div className="flex items-center gap-2">
										<Label className="whitespace-nowrap">{m.line_girouettes_form_options_label()}</Label>
										<ToggleField
											form={form}
											name="routeNumber.flash"
											icon={<ZapIcon />}
											label={m.line_girouettes_form_flash_label()}
										/>
									</div>
								</div>
							)}

							{routeNumberMode !== "bitmap" && (
								<div className="flex flex-col sm:flex-row sm:items-start gap-3">
									<div className="grid gap-2 flex-1 min-w-0">
										<Label>{m.line_girouettes_form_route_number_text_label()}</Label>
										<Input {...form.register("routeNumber.text")} />
									</div>
									<FontVariantField
										className="min-w-0 shrink grow-0 sm:basis-40"
										form={form}
										fieldName="routeNumber.fontVariant"
										fonts={ALL_FONTS}
									/>
									<div className="grid shrink-0 gap-2">
										<Label className="whitespace-nowrap">{m.line_girouettes_form_options_label()}</Label>
										<div className="flex h-9 items-center gap-2">
											<SpacingField form={form} name="routeNumber.spacing" />
											<div className="flex items-center gap-1.5">
												<ToggleField
													form={form}
													name="routeNumber.scroll"
													icon={<FastForwardIcon />}
													label={m.line_girouettes_form_scroll_label()}
												/>
												<ToggleField
													form={form}
													name="routeNumber.flash"
													icon={<ZapIcon />}
													label={m.line_girouettes_form_flash_label()}
												/>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* A drawn block carries its own colors in its palette: a background,
							    an outline and a split pattern would only fight with it. */}
							{routeNumberMode !== "bitmap" && (
								<div className="flex flex-col sm:flex-row sm:items-end gap-3">
									<ColorPickerField
										className="flex-1 min-w-0"
										form={form}
										name="routeNumber.backgroundColor"
										label={m.line_girouettes_form_bg_color_label()}
									/>
									<ColorPickerField
										className="flex-1 min-w-0"
										form={form}
										name="routeNumber.textColor"
										label={m.line_girouettes_form_text_color_label()}
									/>
									<ColorPickerField
										className="flex-1 min-w-0"
										form={form}
										name="routeNumber.outlineColor"
										label={m.line_girouettes_form_outline_color_label()}
									/>
								</div>
							)}

							{routeNumberMode !== "bitmap" && (
								<div className="flex flex-col sm:flex-row sm:items-end gap-3">
									<div className="grid gap-2 sm:w-44 sm:shrink-0">
										<Label>{m.line_girouettes_form_half_pattern_label()}</Label>
										<Controller
											control={form.control}
											name="routeNumber.halfPattern"
											render={({ field }) => {
												const halfPatternItems = [
													{ value: "none", label: m.line_girouettes_form_half_pattern_none() },
													{ value: "tl", label: m.line_girouettes_form_half_pattern_tl() },
													{ value: "tr", label: m.line_girouettes_form_half_pattern_tr() },
													{ value: "bl", label: m.line_girouettes_form_half_pattern_bl() },
													{ value: "br", label: m.line_girouettes_form_half_pattern_br() },
												];
												return (
													<Select
														value={field.value ?? "none"}
														onValueChange={(v) => field.onChange(v === "none" ? null : v)}
														items={halfPatternItems}
													>
														<SelectTrigger className="w-full">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{halfPatternItems.map((item) => (
																<SelectItem key={item.value} value={item.value}>
																	{item.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												);
											}}
										/>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Button type="button" variant="outline" size="sm" onClick={handleSwapRouteColors}>
											<ArrowLeftRightIcon />
											{m.line_girouettes_form_swap_colors()}
										</Button>
										<Button type="button" variant="outline" size="sm" onClick={handleApplyLineColors}>
											<PaletteIcon />
											{m.line_girouettes_form_use_line_colors()}
										</Button>
									</div>
								</div>
							)}
						</div>
					</FormSection>
				</div>

				<FormSection title={m.line_girouettes_form_pages_title()}>
					<div className="flex flex-col gap-4">
						{pageFields.map((field, pageIndex) => (
							<PageFields
								key={field.id}
								form={form}
								paneHeight={previewDimensions.height}
								paneWidth={previewDimensions.destinationWidth}
								pageIndex={pageIndex}
								isOnlyPage={pageFields.length === 1}
								isFirstPage={pageIndex === 0}
								isLastPage={pageIndex === pageFields.length - 1}
								onMovePageUp={() => move(pageIndex, pageIndex - 1)}
								onMovePageDown={() => move(pageIndex, pageIndex + 1)}
								onRemovePage={() => remove(pageIndex)}
							/>
						))}

						{pageFields.length < 10 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="self-start"
								onClick={() => append(defaultPage())}
							>
								<PlusIcon />
								{m.line_girouettes_form_page_add()}
							</Button>
						)}
					</div>
				</FormSection>

				<div className="flex justify-end gap-3 lg:col-span-2">
					<Button type="button" variant="outline" onClick={backToList} disabled={isPending}>
						{m.line_girouettes_form_cancel()}
					</Button>
					<Button variant="branding-default" type="submit" disabled={isPending}>
						{m.line_girouettes_form_save()}
					</Button>
				</div>
			</form>
		</DataPageLayout>
	);
}

// ---

type FormSectionProps = {
	children: ReactNode;
	title: string;
};

/** Bordered section whose title sits within the top border, fieldset/legend style. */
function FormSection({ children, title }: Readonly<FormSectionProps>) {
	return (
		<fieldset className="min-w-0 rounded-xl border border-foreground/15 bg-card px-3 pt-2 pb-3">
			<legend className="cn-font-heading mx-1 px-1.5 text-sm font-medium">{title}</legend>
			{children}
		</fieldset>
	);
}

// ---

type PageFieldsProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	/** Matrix size of the destination pane, which a drawn page fills entirely. */
	paneHeight: number;
	paneWidth: number;
	pageIndex: number;
	isOnlyPage: boolean;
	isFirstPage: boolean;
	isLastPage: boolean;
	onMovePageUp: () => void;
	onMovePageDown: () => void;
	onRemovePage: () => void;
};

function PageFields({
	form,
	paneHeight,
	paneWidth,
	pageIndex,
	isOnlyPage,
	isFirstPage,
	isLastPage,
	onMovePageUp,
	onMovePageDown,
	onRemovePage,
}: Readonly<PageFieldsProps>) {
	const mode = useWatch({ control: form.control, name: `pages.${pageIndex}.mode` }) ?? "text";
	const lines = useWatch({ control: form.control, name: `pages.${pageIndex}.lines` }) ?? [];
	const line1Variant = (useWatch({
		control: form.control,
		name: `pages.${pageIndex}.lines.0.fontVariant`,
	}) ?? DEFAULT_FONT_VARIANT) as AllowedFont;
	const hasTwoLines = lines.length === 2;
	const line1Fonts = hasTwoLines ? DUAL_LINE_FONTS : ALL_FONTS;
	const line2Fonts = getFontsForDualLine(line1Variant);

	const handleAddLine = () => {
		const currentLines = form.getValues(`pages.${pageIndex}.lines`);
		// Line 1 is limited to short fonts once a second line shares the pane.
		const newLine1Font = getLine1FontForDualLine(line1Variant);
		const availableForLine2 = getFontsForDualLine(newLine1Font);
		form.setValue(`pages.${pageIndex}.lines`, [
			{ ...currentLines[0], fontVariant: newLine1Font },
			...currentLines.slice(1),
			defaultLine(availableForLine2[0] ?? DEFAULT_FONT_VARIANT),
		]);
	};

	const handleRemoveLine = (lineIndex: number) => {
		const currentLines = form.getValues(`pages.${pageIndex}.lines`);
		form.setValue(
			`pages.${pageIndex}.lines`,
			currentLines.filter((_, i) => i !== lineIndex),
		);
	};

	const handleLine1FontChange = (newVariant: string) => {
		if (!hasTwoLines) return;
		const validFonts = getFontsForDualLine(newVariant as AllowedFont);
		const line2Variant = form.getValues(`pages.${pageIndex}.lines.1.fontVariant`) as AllowedFont;
		if (!validFonts.includes(line2Variant)) {
			form.setValue(
				`pages.${pageIndex}.lines.1.fontVariant` as "routeNumber.fontVariant",
				validFonts[0] ?? DEFAULT_FONT_VARIANT,
			);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="-mx-3 flex h-8 items-center justify-between gap-2 border-y bg-muted/40 px-3">
				<span className="text-sm font-medium">{m.line_girouettes_form_page_n({ n: pageIndex + 1 })}</span>
				<div className="flex items-center gap-0.5">
					<PaneModeField compact form={form} name={`pages.${pageIndex}.mode`} />
					{!isOnlyPage && (
						<>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								title={m.line_girouettes_form_page_move_up()}
								disabled={isFirstPage}
								onClick={onMovePageUp}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								title={m.line_girouettes_form_page_move_down()}
								disabled={isLastPage}
								onClick={onMovePageDown}
							>
								<ArrowDownIcon />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								title={m.line_girouettes_form_page_remove()}
								onClick={onRemovePage}
							>
								<TrashIcon className="text-destructive" />
							</Button>
						</>
					)}
				</div>
			</div>

			{mode === "bitmap" && (
				<div className="flex flex-col gap-3">
					<Controller
						control={form.control}
						name={`pages.${pageIndex}.bitmap` as "routeNumber.bitmap"}
						render={({ field }) => (
							<BitmapEditorDialog
								height={paneHeight}
								ledColor="WHITE"
								onChange={field.onChange}
								title={m.line_girouettes_form_page_n({ n: pageIndex + 1 })}
								value={paneBitmap(field.value as GirouetteBitmap | null, paneWidth, paneHeight)}
								width={paneWidth}
							/>
						)}
					/>
					<AltTextField
						error={form.formState.errors.pages?.[pageIndex]?.altText?.message}
						form={form}
						name={`pages.${pageIndex}.altText`}
					/>
					<div className="flex items-center gap-2">
						<Label className="whitespace-nowrap">{m.line_girouettes_form_options_label()}</Label>
						<ToggleField
							form={form}
							name={`pages.${pageIndex}.flash`}
							icon={<ZapIcon />}
							label={m.line_girouettes_form_flash_label()}
						/>
					</div>
				</div>
			)}

			{mode !== "bitmap" &&
				lines.map((_, lineIndex) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: stable order
						key={lineIndex}
						className={cn("flex flex-col gap-1", lineIndex > 0 && "pt-1")}
					>
						<div className="flex flex-col sm:flex-row sm:items-start gap-3">
							<div className="grid gap-2 flex-1 min-w-0">
								<Label>
									{lines.length > 1
										? m.line_girouettes_form_line_n({ n: lineIndex + 1 })
										: m.line_girouettes_form_page_text_label()}
								</Label>
								<Input {...form.register(`pages.${pageIndex}.lines.${lineIndex}.text`)} />
							</div>
							<FontVariantField
								className="min-w-0 shrink grow-0 sm:basis-40"
								form={form}
								fieldName={`pages.${pageIndex}.lines.${lineIndex}.fontVariant`}
								fonts={lineIndex === 0 ? line1Fonts : line2Fonts}
								onAfterChange={lineIndex === 0 ? handleLine1FontChange : undefined}
							/>
							<div className="grid shrink-0 gap-2">
								<Label className="whitespace-nowrap">{m.line_girouettes_form_options_label()}</Label>
								<div className="flex h-9 items-center gap-2">
									<SpacingField form={form} name={`pages.${pageIndex}.lines.${lineIndex}.spacing`} />
									<div className="flex items-center gap-1.5">
										<ToggleField
											form={form}
											name={`pages.${pageIndex}.lines.${lineIndex}.scroll`}
											icon={<FastForwardIcon />}
											label={m.line_girouettes_form_scroll_label()}
										/>
										<ToggleField
											form={form}
											name={`pages.${pageIndex}.lines.${lineIndex}.flash`}
											icon={<ZapIcon />}
											label={m.line_girouettes_form_flash_label()}
										/>
										<ToggleField
											form={form}
											name={`pages.${pageIndex}.lines.${lineIndex}.inverted`}
											icon={<ArrowLeftRightIcon />}
											label="Inverser les couleurs"
										/>
									</div>
									{/* Sits on the controls row rather than above it, so that the lines
								    don't need a header of their own just to carry it. */}
									{hasTwoLines && (
										<Button
											type="button"
											variant="outline"
											size="icon-sm"
											title={m.line_girouettes_form_line_remove()}
											aria-label={m.line_girouettes_form_line_remove()}
											onClick={() => handleRemoveLine(lineIndex)}
										>
											<TrashIcon className="text-destructive" />
										</Button>
									)}
								</div>
							</div>
						</div>
					</div>
				))}

			{mode !== "bitmap" && !hasTwoLines && (
				<Button
					className="w-full border-dashed text-muted-foreground"
					type="button"
					variant="outline"
					size="sm"
					onClick={handleAddLine}
				>
					<PlusIcon />
					{m.line_girouettes_form_line_add_second()}
				</Button>
			)}
		</div>
	);
}

// ---

type FontVariantFieldProps = {
	className?: string;
	form: ReturnType<typeof useForm<FormValues>>;
	fieldName: string;
	fonts: readonly AllowedFont[];
	onAfterChange?: (v: string) => void;
};

function FontVariantField({ className, form, fieldName, fonts, onAfterChange }: Readonly<FontVariantFieldProps>) {
	return (
		<div className={cn("grid gap-2", className)}>
			<Label>{m.line_girouettes_form_font_variant_label()}</Label>
			<Controller
				control={form.control}
				name={fieldName as "routeNumber.fontVariant"}
				render={({ field }) => (
					<Select
						key={fonts.join(",")}
						value={field.value}
						onValueChange={(v) => {
							field.onChange(v);
							if (v !== null) onAfterChange?.(v);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{fonts.map((v) => (
								<SelectItem key={v} value={v}>
									{getFontLabel(v)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			/>
		</div>
	);
}

// ---

type ColorPickerFieldProps = {
	className?: string;
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
	label: string;
};

function ColorPickerField({ className, form, name, label }: Readonly<ColorPickerFieldProps>) {
	return (
		<div className={cn("grid gap-2", className)}>
			<Label>{label}</Label>
			<Controller
				control={form.control}
				name={name as "routeNumber.textColor"}
				render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
			/>
		</div>
	);
}

// ---

type ToggleFieldProps = {
	className?: string;
	form: ReturnType<typeof useForm<FormValues>>;
	icon: ReactNode;
	/** Carried by the tooltip and the accessible name, as the button shows only its icon. */
	label: string;
	name: string;
};

/** Icon button toggling a boolean field of the form, lit up while it is on. */
function ToggleField({ className, form, icon, label, name }: Readonly<ToggleFieldProps>) {
	return (
		<Controller
			control={form.control}
			name={name as "routeNumber.scroll"}
			render={({ field }) => (
				<Button
					className={className}
					type="button"
					variant={field.value ? "branding-default" : "outline"}
					size="icon-sm"
					title={label}
					aria-label={label}
					aria-pressed={field.value}
					onClick={() => field.onChange(!field.value)}
				>
					{icon}
				</Button>
			)}
		/>
	);
}

// ---

type SpacingFieldProps = {
	className?: string;
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
};

/**
 * The two steppers and the current value form a single block: each segment keeps
 * only its outer corners rounded and overlaps the border of its neighbour, and
 * the labels live in the tooltips so that the whole thing fits on one row.
 */
function SpacingField({ className, form, name }: Readonly<SpacingFieldProps>) {
	return (
		<Controller
			control={form.control}
			name={name as "routeNumber.spacing"}
			render={({ field }) => {
				const value = field.value as number | null;
				return (
					<div className={cn("flex items-center", className)}>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-r-none px-2"
							title={m.line_girouettes_form_spacing_decrease()}
							aria-label={m.line_girouettes_form_spacing_decrease()}
							disabled={value === null}
							onClick={() => field.onChange(value === 0 ? null : (value ?? 0) - 1)}
						>
							<ChevronsRightLeftIcon />
						</Button>
						<span
							className="-mx-px flex h-7 w-8 items-center justify-center border border-border bg-background text-sm tabular-nums select-none dark:border-input dark:bg-input/30"
							title={m.line_girouettes_form_spacing_label()}
						>
							{value ?? "–"}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-l-none px-2"
							title={m.line_girouettes_form_spacing_increase()}
							aria-label={m.line_girouettes_form_spacing_increase()}
							disabled={value === 10}
							onClick={() => field.onChange(value === null ? 0 : value + 1)}
						>
							<ChevronsLeftRightIcon />
						</Button>
					</div>
				);
			}}
		/>
	);
}

// ---

type AltTextFieldProps = {
	error?: string;
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
};

/**
 * Description of a drawn pane. It is what a screen reader announces, and what a
 * client that can't display a drawing shows in its place, so it is required.
 */
function AltTextField({ error, form, name }: Readonly<AltTextFieldProps>) {
	return (
		<div className="grid gap-2">
			<Label>{m.line_girouettes_form_alt_text_label()}</Label>
			<Input
				{...form.register(name as "routeNumber.altText")}
				aria-invalid={error !== undefined}
				placeholder={m.line_girouettes_form_alt_text_placeholder()}
			/>
			{error !== undefined ? (
				<p className="text-xs text-destructive">{error}</p>
			) : (
				<p className="text-xs text-muted-foreground">{m.line_girouettes_form_alt_text_help()}</p>
			)}
		</div>
	);
}

// ---

type PaneModeFieldProps = {
	/** Icon-only variant, for the header bar of a page. */
	compact?: boolean;
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
};

/**
 * Switches a pane between its text form and its freely drawn one. Both keep
 * their own values, so hesitating between the two never loses anything.
 */
function PaneModeField({ compact = false, form, name }: Readonly<PaneModeFieldProps>) {
	const modes = [
		{ value: "text" as const, icon: <TypeIcon />, label: m.line_girouettes_form_mode_text() },
		{ value: "bitmap" as const, icon: <BrushIcon />, label: m.line_girouettes_form_mode_bitmap() },
	];

	return (
		<Controller
			control={form.control}
			name={name as "routeNumber.mode"}
			render={({ field }) => (
				<div className="flex items-center gap-2">
					{!compact && <Label className="whitespace-nowrap">{m.line_girouettes_form_mode_label()}</Label>}
					<div className="flex items-center gap-1">
						{modes.map((mode) => (
							<Button
								key={mode.value}
								type="button"
								variant={field.value === mode.value ? "branding-default" : "outline"}
								size={compact ? "icon-sm" : "sm"}
								title={compact ? mode.label : undefined}
								aria-label={compact ? mode.label : undefined}
								aria-pressed={field.value === mode.value}
								onClick={() => field.onChange(mode.value)}
							>
								{mode.icon}
								{!compact && mode.label}
							</Button>
						))}
					</div>
				</div>
			)}
		/>
	);
}
