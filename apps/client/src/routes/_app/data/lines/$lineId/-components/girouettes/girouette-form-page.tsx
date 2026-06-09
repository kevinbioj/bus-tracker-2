import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { cn } from "~/utils/cn";
import {
	ALLOWED_FONT_FAMILIES,
	type AllowedFont,
	type AllowedFontFamily,
	DEFAULT_FONT_FAMILY,
	DEFAULT_FONT_VARIANT,
	FONT_HEIGHTS,
	getFontFamily,
} from "./font-config";

const pageSchema = z.object({
	text: z.string(),
	fontFamily: z.string(),
	fontVariant: z.string(),
	scroll: z.boolean(),
	spacing: z.number().int().min(0).max(10).nullable(),
});

const formSchema = z.object({
	directionId: z.string().nullable(),
	destinations: z.array(z.string()),
	routeNumber: z.object({
		text: z.string(),
		fontFamily: z.string(),
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

const defaultPage = (): FormValues["pages"][number] => ({
	text: "",
	fontFamily: DEFAULT_FONT_FAMILY,
	fontVariant: DEFAULT_FONT_VARIANT,
	scroll: false,
	spacing: null,
});

const defaultValues = (girouette?: Girouette): FormValues => {
	if (!girouette) {
		return {
			directionId: null,
			destinations: [],
			routeNumber: {
				text: "",
				fontFamily: DEFAULT_FONT_FAMILY,
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
	const rnFont = d.routeNumber?.font ?? DEFAULT_FONT_VARIANT;

	return {
		directionId: girouette.directionId !== null ? String(girouette.directionId) : null,
		destinations: girouette.destinations,
		routeNumber: {
			text: d.routeNumber?.text ?? "",
			fontFamily: getFontFamily(rnFont),
			fontVariant: rnFont,
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
						const p = Array.isArray(page) ? page[0] : page;
						const font = p.font ?? DEFAULT_FONT_VARIANT;
						return {
							text: p.text,
							fontFamily: getFontFamily(font),
							fontVariant: font,
							scroll: p.scroll ?? false,
							spacing: p.spacing ?? null,
						};
					})
				: [defaultPage()],
	};
};

function formToGirouetteInput(values: FormValues, enabled = true): GirouetteInput {
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
		pages: values.pages.map((page) => ({
			text: page.text,
			font: page.fontVariant as AllowedFont,
			scroll: page.scroll || undefined,
			spacing: page.spacing ?? undefined,
		})),
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

	const backToList = () => navigate({ to: "/data/lines/$lineId", params: { lineId: String(lineId) } });

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
		pages: (watchedValues.pages ?? []).map((page) => ({
			text: page?.text ?? "",
			font: (page?.fontVariant as AllowedFont) ?? DEFAULT_FONT_VARIANT,
			scroll: page?.scroll || undefined,
			spacing: page?.spacing ?? undefined,
		})),
	};

	const isPending = createMutation.isPending || updateMutation.isPending;
	const isEdit = girouette !== undefined;

	return (
		<DataPageLayout
			current={isEdit ? m.line_girouettes_form_edit_title() : m.line_girouettes_form_create_title()}
			breadcrumbMiddle={[
				{
					label: line.number,
					to: "/data/lines/$lineId",
					params: { lineId: String(lineId) },
				},
			]}
			network={network}
			networkSearch={{ tab: "lines" }}
			title={m.line_girouettes_page_title({ lineNumber: line.number, networkName: network.name })}
		>
			<div className="mt-4 flex flex-col gap-2">
				<p className="text-sm font-semibold">{m.line_girouettes_form_preview_title()}</p>
				<div className="overflow-x-auto">
					<GirouettePreview width={560} {...previewData} />
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-6">
				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap items-end gap-4">
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

						<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
							<div className="grid gap-2">
								<Label>{m.line_girouettes_form_route_number_text_label()}</Label>
								<Input {...form.register("routeNumber.text")} />
							</div>
							<FontFamilySelect form={form} familyName="routeNumber.fontFamily" variantName="routeNumber.fontVariant" />
							<SpacingField form={form} name="routeNumber.spacing" />
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
							<Controller
								control={form.control}
								name="routeNumber.scroll"
								render={({ field }) => (
									<Label className="ml-4 flex items-center gap-2 cursor-pointer w-fit pb-1">
										<Switch checked={field.value} onCheckedChange={field.onChange} />
										{m.line_girouettes_form_scroll_label()}
									</Label>
								)}
							/>
						</div>
					</fieldset>

					<fieldset className="border rounded-lg p-4 flex flex-col gap-4">
						<legend className="text-sm font-semibold px-1">{m.line_girouettes_form_pages_title()}</legend>

						{pageFields.map((field, index) => (
							<div key={field.id} className={cn("flex flex-col gap-3", index > 0 && "border-t pt-3")}>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">{m.line_girouettes_form_page_n({ n: index + 1 })}</span>
									{pageFields.length > 1 && (
										<Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
											<TrashIcon />
										</Button>
									)}
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
									<div className="grid gap-2">
										<Label>{m.line_girouettes_form_page_text_label()}</Label>
										<Input {...form.register(`pages.${index}.text`)} />
									</div>
									<FontFamilySelect
										form={form}
										familyName={`pages.${index}.fontFamily`}
										variantName={`pages.${index}.fontVariant`}
									/>
									<SpacingField form={form} name={`pages.${index}.spacing`} />
								</div>

								<Controller
									control={form.control}
									name={`pages.${index}.scroll`}
									render={({ field }) => (
										<Label className="flex items-center gap-2 cursor-pointer w-fit">
											<Switch checked={field.value} onCheckedChange={field.onChange} />
											{m.line_girouettes_form_scroll_label()}
										</Label>
									)}
								/>
							</div>
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

type FontFamilySelectProps = {
	form: ReturnType<typeof useForm<FormValues>>;
	familyName: string;
	variantName: string;
};

function FontFamilySelect({ form, familyName, variantName }: Readonly<FontFamilySelectProps>) {
	const fontFamily = useWatch({ control: form.control, name: familyName as "routeNumber.fontFamily" });
	const variants =
		(ALLOWED_FONT_FAMILIES[fontFamily as AllowedFontFamily] as readonly string[] | undefined) ??
		(ALLOWED_FONT_FAMILIES[DEFAULT_FONT_FAMILY] as readonly string[]);

	return (
		<>
			<div className="grid gap-2">
				<Label>{m.line_girouettes_form_font_family_label()}</Label>
				<Controller
					control={form.control}
					name={familyName as "routeNumber.fontFamily"}
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={(v) => {
								field.onChange(v);
								const first = ALLOWED_FONT_FAMILIES[v as AllowedFontFamily]?.[0];
								if (first) form.setValue(variantName as "routeNumber.fontVariant", first);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(ALLOWED_FONT_FAMILIES) as AllowedFontFamily[]).map((fam) => (
									<SelectItem key={fam} value={fam}>
										{fam}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</div>

			<div className="grid gap-2">
				<Label>{m.line_girouettes_form_font_variant_label()}</Label>
				<Controller
					control={form.control}
					name={variantName as "routeNumber.fontVariant"}
					render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{variants.map((v) => (
									<SelectItem key={v} value={v}>
										{v} ({FONT_HEIGHTS[v as AllowedFont]}px)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</div>
		</>
	);
}

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
