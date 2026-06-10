import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useWindowSize } from "usehooks-ts";
import { z } from "zod";

import {
	CreateGirouetteMutation,
	GetLineGirouettesQuery,
	type Girouette,
	type GirouetteInput,
	UpdateGirouetteMutation,
} from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { ColorPicker } from "~/components/ui/color-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
	type GirouetteData,
	Girouette as GirouettePreview,
	type TextSpacing,
} from "~/components/vehicles-map/vehicles-markers/popup/girouette";
import * as m from "~/paraglide/messages";
import { DataPageLayout, LineBreadcrumbLabel } from "~/routes/_app/data/-components/data-page-layout";
import { cn } from "~/utils/cn";
import { ALL_FONTS, type AllowedFont, DEFAULT_FONT_VARIANT, getFontLabel, getFontsForDualLine } from "./font-config";

const lineSchema = z.object({
	text: z.string(),
	fontVariant: z.string(),
	scroll: z.boolean(),
	spacing: z.number().int().min(0).max(10).nullable(),
});

const pageSchema = z.object({
	lines: z.array(lineSchema).min(1).max(2),
});

const formSchema = z.object({
	directionId: z.string().nullable(),
	destinations: z.array(z.string()),
	routeNumber: z.object({
		text: z.string(),
		fontVariant: z.string(),
		textColor: z.string(),
		backgroundColor: z.string(),
		outlineColor: z.string(),
		scroll: z.boolean(),
		spacing: z.number().int().min(0).max(10).nullable(),
		halfPattern: z.enum(["tl", "tr", "bl", "br"]).nullable(),
	}),
	pages: z.array(pageSchema).min(1).max(10),
});

type FormValues = z.infer<typeof formSchema>;

const defaultLine = (fontVariant = DEFAULT_FONT_VARIANT): FormValues["pages"][number]["lines"][number] => ({
	text: "",
	fontVariant,
	scroll: false,
	spacing: null,
});

const defaultPage = (): FormValues["pages"][number] => ({
	lines: [defaultLine()],
});

const defaultValues = (girouette?: Girouette): FormValues => {
	if (!girouette) {
		return {
			directionId: null,
			destinations: [],
			routeNumber: {
				text: "",
				fontVariant: DEFAULT_FONT_VARIANT,
				textColor: "",
				backgroundColor: "",
				outlineColor: "",
				scroll: false,
				spacing: null,
				halfPattern: null,
			},
			pages: [defaultPage()],
		};
	}

	const d = girouette.data;

	return {
		directionId: girouette.directionId !== null ? String(girouette.directionId) : null,
		destinations: girouette.destinations,
		routeNumber: {
			text: d.routeNumber?.text ?? "",
			fontVariant: d.routeNumber?.font ?? DEFAULT_FONT_VARIANT,
			textColor: d.routeNumber?.textColor ?? "",
			backgroundColor: d.routeNumber?.backgroundColor ?? "",
			outlineColor: d.routeNumber?.outlineColor ?? "",
			scroll: d.routeNumber?.scroll ?? false,
			spacing: d.routeNumber?.spacing ?? null,
			halfPattern: d.routeNumber?.halfPattern ?? null,
		},
		pages:
			(d.pages ?? []).length > 0
				? (d.pages ?? []).map((page) => {
						const rawLines = Array.isArray(page) ? page : [page];
						return {
							lines: rawLines.map((line) => ({
								text: line.text,
								fontVariant: line.font ?? DEFAULT_FONT_VARIANT,
								scroll: line.scroll ?? false,
								spacing: line.spacing ?? null,
							})),
						};
					})
				: [defaultPage()],
	};
};

function formToGirouetteInput(values: FormValues, enabled = true): GirouetteInput {
	type PageLine = { font?: AllowedFont; scroll?: boolean; spacing?: TextSpacing; text: string };

	const data: GirouetteData = {
		ledColor: "WHITE",
		routeNumber: {
			text: values.routeNumber.text,
			font: values.routeNumber.fontVariant as AllowedFont,
			textColor: values.routeNumber.textColor || undefined,
			backgroundColor: values.routeNumber.backgroundColor || undefined,
			outlineColor: values.routeNumber.outlineColor || undefined,
			scroll: values.routeNumber.scroll || undefined,
			spacing: (values.routeNumber.spacing ?? undefined) as TextSpacing | undefined,
			halfPattern: values.routeNumber.halfPattern ?? undefined,
		},
		pages: values.pages.map((page) => {
			const lines: PageLine[] = page.lines.map((line) => ({
				text: line.text,
				font: line.fontVariant as AllowedFont,
				scroll: line.scroll || undefined,
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
};

export function GirouetteFormPage({ lineId, girouetteId }: Readonly<GirouetteFormPageProps>) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const snackbar = useSnackbar();
	const { width } = useWindowSize();

	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { data: girouettes } = useSuspenseQuery(GetLineGirouettesQuery(lineId));

	const girouette = girouetteId !== undefined ? girouettes.find((g) => g.id === girouetteId) : undefined;

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: defaultValues(girouette),
	});

	const { fields: pageFields, append, remove } = useFieldArray({ control: form.control, name: "pages" });
	const [newDest, setNewDest] = useState("");
	const watchedDestinations = useWatch({ control: form.control, name: "destinations" }) ?? [];

	const handleAddDestination = () => {
		const trimmed = newDest.trim();
		if (!trimmed || watchedDestinations.includes(trimmed)) return;
		form.setValue("destinations", [...watchedDestinations, trimmed]);
		setNewDest("");
	};

	const handleRemoveDestination = (index: number) => {
		form.setValue(
			"destinations",
			watchedDestinations.filter((_, i) => i !== index),
		);
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
		const input = formToGirouetteInput(values, girouette?.enabled ?? true);
		if (girouette) updateMutation.mutate(input);
		else createMutation.mutate(input);
	};

	const watchedValues = useWatch({ control: form.control });
	const previewData: GirouetteData = {
		ledColor: "WHITE",
		routeNumber: watchedValues.routeNumber
			? {
					text: watchedValues.routeNumber.text ?? "",
					font: (watchedValues.routeNumber.fontVariant as AllowedFont) ?? DEFAULT_FONT_VARIANT,
					textColor: watchedValues.routeNumber.textColor || undefined,
					backgroundColor: watchedValues.routeNumber.backgroundColor || undefined,
					outlineColor: watchedValues.routeNumber.outlineColor || undefined,
					scroll: watchedValues.routeNumber.scroll || undefined,
					spacing: (watchedValues.routeNumber.spacing ?? undefined) as TextSpacing | undefined,
					halfPattern: watchedValues.routeNumber.halfPattern ?? undefined,
				}
			: { text: "" },
		pages: (watchedValues.pages ?? []).map((page) => {
			const lines = (page?.lines ?? []).map((line) => ({
				text: line?.text ?? "",
				font: (line?.fontVariant as AllowedFont) ?? DEFAULT_FONT_VARIANT,
				scroll: line?.scroll || undefined,
				spacing: line?.spacing ?? undefined,
			}));
			return lines.length === 2
				? (lines as unknown as [{ text: string; font: AllowedFont }, { text: string; font: AllowedFont }])
				: (lines[0] ?? { text: "" });
		}) as GirouetteData["pages"],
	};

	const isPending = createMutation.isPending || updateMutation.isPending;
	const isEdit = girouette !== undefined;

	return (
		<DataPageLayout
			current={isEdit ? m.line_girouettes_form_edit_title() : m.line_girouettes_form_create_title()}
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
				<div className="overflow-x-auto">
					<GirouettePreview width={Math.min(width - 26, 512)} {...previewData} />
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 flex flex-col gap-6">
				<div className="flex flex-col gap-6">
					<div className="flex flex-col md:flex-row gap-4">
						<div className="grid gap-2">
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
											<SelectTrigger>
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

						<div className="grid gap-2 flex-1 min-w-0">
							<Label>{m.line_girouettes_form_destination_label()}</Label>
							<div className="flex flex-wrap items-center gap-1.5">
								<Input
									className="w-44 shrink-0"
									value={newDest}
									onChange={(e) => setNewDest(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddDestination();
										}
									}}
									placeholder={m.line_girouettes_form_destination_placeholder()}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleAddDestination}
									disabled={!newDest.trim() || watchedDestinations.includes(newDest.trim())}
								>
									<PlusIcon />
								</Button>
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
						</div>
					</div>

					<fieldset className="border rounded-lg p-4 flex flex-col gap-4">
						<legend className="text-sm font-semibold px-1">{m.line_girouettes_form_route_number_title()}</legend>

						<div className="flex flex-wrap gap-5">
							<div className="grid gap-2">
								<Label>{m.line_girouettes_form_route_number_text_label()}</Label>
								<Input {...form.register("routeNumber.text")} />
							</div>
							<FontVariantField form={form} fieldName="routeNumber.fontVariant" fonts={ALL_FONTS} />
							<SpacingField form={form} name="routeNumber.spacing" />
							<ScrollField form={form} name="routeNumber.scroll" />
						</div>

						<div className="flex flex-wrap items-end gap-3">
							<ColorPickerField
								form={form}
								name="routeNumber.textColor"
								label={m.line_girouettes_form_text_color_label()}
							/>
							<ColorPickerField
								form={form}
								name="routeNumber.backgroundColor"
								label={m.line_girouettes_form_bg_color_label()}
							/>
							<ColorPickerField
								form={form}
								name="routeNumber.outlineColor"
								label={m.line_girouettes_form_outline_color_label()}
							/>
							<div className="grid gap-2">
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
												<SelectTrigger>
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
						</div>
					</fieldset>

					<fieldset className="border rounded-lg p-4 flex flex-col gap-4">
						<legend className="text-sm font-semibold px-1">{m.line_girouettes_form_pages_title()}</legend>

						{pageFields.map((field, pageIndex) => (
							<PageFields
								key={field.id}
								form={form}
								pageIndex={pageIndex}
								isOnlyPage={pageFields.length === 1}
								onRemovePage={() => remove(pageIndex)}
							/>
						))}

						{pageFields.length < 10 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="self-start mt-1"
								onClick={() => append(defaultPage())}
							>
								<PlusIcon />
								{m.line_girouettes_form_page_add()}
							</Button>
						)}
					</fieldset>

					<div className="flex gap-3">
						<Button variant="branding-default" type="submit" disabled={isPending}>
							{m.line_girouettes_form_save()}
						</Button>
						<Button type="button" variant="outline" onClick={backToList} disabled={isPending}>
							{m.line_girouettes_form_cancel()}
						</Button>
					</div>
				</div>
			</form>
		</DataPageLayout>
	);
}

// ---

type PageFieldsProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	pageIndex: number;
	isOnlyPage: boolean;
	onRemovePage: () => void;
};

function PageFields({ form, pageIndex, isOnlyPage, onRemovePage }: Readonly<PageFieldsProps>) {
	const lines = useWatch({ control: form.control, name: `pages.${pageIndex}.lines` }) ?? [];
	const line1Variant = (useWatch({
		control: form.control,
		name: `pages.${pageIndex}.lines.0.fontVariant`,
	}) ?? DEFAULT_FONT_VARIANT) as AllowedFont;
	const hasTwoLines = lines.length === 2;
	const line2Fonts = getFontsForDualLine(line1Variant);

	const handleAddLine = () => {
		const currentLines = form.getValues(`pages.${pageIndex}.lines`);
		const availableForLine2 = getFontsForDualLine(line1Variant);
		form.setValue(`pages.${pageIndex}.lines`, [
			...currentLines,
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
		<div className={cn("flex flex-col gap-3", pageIndex > 0 && "border-t pt-3")}>
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">{m.line_girouettes_form_page_n({ n: pageIndex + 1 })}</span>
				{!isOnlyPage && (
					<Button type="button" variant="ghost" size="icon-sm" onClick={onRemovePage}>
						<TrashIcon />
					</Button>
				)}
			</div>

			{lines.map((_, lineIndex) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: stable order
					key={lineIndex}
					className="flex items-end gap-2"
				>
					<div className="flex flex-wrap gap-5">
						<div className="grid gap-2">
							<Label>{m.line_girouettes_form_page_text_label()}</Label>
							<Input {...form.register(`pages.${pageIndex}.lines.${lineIndex}.text`)} />
						</div>
						<FontVariantField
							form={form}
							fieldName={`pages.${pageIndex}.lines.${lineIndex}.fontVariant`}
							fonts={lineIndex === 0 ? ALL_FONTS : line2Fonts}
							onAfterChange={lineIndex === 0 ? handleLine1FontChange : undefined}
						/>
						<SpacingField form={form} name={`pages.${pageIndex}.lines.${lineIndex}.spacing`} />
						<ScrollField form={form} name={`pages.${pageIndex}.lines.${lineIndex}.scroll`} />
					</div>
					{lineIndex === 0 && !hasTwoLines && (
						<Button className="ml-auto" type="button" variant="outline" size="icon-sm" onClick={handleAddLine}>
							<PlusIcon />
						</Button>
					)}
					{lineIndex === 1 && (
						<Button
							className="ml-auto"
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => handleRemoveLine(lineIndex)}
						>
							<TrashIcon />
						</Button>
					)}
				</div>
			))}
		</div>
	);
}

// ---

type FontVariantFieldProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	fieldName: string;
	fonts: readonly AllowedFont[];
	onAfterChange?: (v: string) => void;
};

function FontVariantField({ form, fieldName, fonts, onAfterChange }: Readonly<FontVariantFieldProps>) {
	return (
		<div className="grid gap-2">
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
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
	label: string;
};

function ColorPickerField({ form, name, label }: Readonly<ColorPickerFieldProps>) {
	return (
		<div className="grid gap-2">
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

type ScrollFieldProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
};

function ScrollField({ form, name }: Readonly<ScrollFieldProps>) {
	return (
		<Controller
			control={form.control}
			name={name as "routeNumber.scroll"}
			render={({ field }) => (
				<Label className="flex flex-col gap-2 cursor-pointer font-normal">
					<span className="text-sm font-medium leading-none">{m.line_girouettes_form_scroll_label()}</span>
					<div className="flex h-9 items-center">
						<Switch checked={field.value} onCheckedChange={field.onChange} />
					</div>
				</Label>
			)}
		/>
	);
}

// ---

type SpacingFieldProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	name: string;
};

function SpacingField({ form, name }: Readonly<SpacingFieldProps>) {
	return (
		<div className="grid gap-2">
			<Label>{m.line_girouettes_form_spacing_label()}</Label>
			<Controller
				control={form.control}
				name={name as "routeNumber.spacing"}
				render={({ field }) => {
					const value = field.value as number | null;
					return (
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="px-2 font-mono"
								disabled={value === null}
								onClick={() => field.onChange(value === 0 ? null : (value ?? 0) - 1)}
							>
								{"><"}
							</Button>
							<span className="w-8 text-center text-sm tabular-nums select-none">{value ?? "–"}</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="px-2 font-mono"
								disabled={value === 10}
								onClick={() => field.onChange(value === null ? 0 : value + 1)}
							>
								{"<>"}
							</Button>
						</div>
					);
				}}
			/>
		</div>
	);
}
