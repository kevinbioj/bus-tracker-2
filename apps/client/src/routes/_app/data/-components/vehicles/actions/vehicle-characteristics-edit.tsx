import {
	type VehicleJourneyLineType,
	vehicleJourneyLineTypes,
	vehicleJourneyLineTypeZodEnum,
} from "@bus-tracker/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { GetNetworkQuery } from "~/api/networks";
import { UpdateVehicleMutation, type Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useEditor } from "~/hooks/use-editor";
import * as m from "~/paraglide/messages";

const updateVehicleFormSchema = z.object({
	number: z.string().min(1, "Expected 'number' to be non-empty."),
	designation: z.string().nullable(),
	tcId: z.number().min(1, "Expected 'tcId' to be a valid identifier.").nullable(),
	type: vehicleJourneyLineTypeZodEnum,
	operatorId: z.number().nullable(),
});

const noOperatorSelectValue = "none";

type UpdateVehicleFormData = z.infer<typeof updateVehicleFormSchema>;

const lineTypeLabels: Record<VehicleJourneyLineType, () => string> = {
	BUS: m.vehicle_type_bus,
	TROLLEY: m.vehicle_type_trolley,
	COACH: m.vehicle_type_coach,
	FERRY: m.vehicle_type_ferry,
	RAIL: m.vehicle_type_rail,
	SUBWAY: m.vehicle_type_subway,
	TRAMWAY: m.vehicle_type_tramway,
	FUNICULAR: m.vehicle_type_funicular,
	UNKNOWN: m.vehicle_type_other,
};

type VehicleCharacteristicsEditProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	vehicle: Vehicle;
};

export function VehicleCharacteristicsEdit({ open, onOpenChange, vehicle }: Readonly<VehicleCharacteristicsEditProps>) {
	const { editorToken } = useEditor();

	const snackbar = useSnackbar();

	const queryClient = useQueryClient();
	const { isPending: updatingVehicle, mutateAsync: updateVehicle } = useMutation(UpdateVehicleMutation(vehicle.id));

	const { data: network } = useQuery(GetNetworkQuery(vehicle.networkId, true));

	const form = useForm<UpdateVehicleFormData>({
		defaultValues: {
			designation: vehicle.designation,
			number: vehicle.number,
			tcId: vehicle.tcId,
			type: vehicle.type,
			operatorId: vehicle.operatorId,
		},
		resolver: zodResolver(updateVehicleFormSchema),
	});

	const selectableOperators = useMemo(() => {
		if (network === undefined) {
			return;
		}

		return [
			{ label: m.network_vehicle_operator_no(), value: noOperatorSelectValue },
			...network.operators
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((operator) => ({ label: operator.name, value: String(operator.id) })),
		];
	}, [network]);

	const handleOpenChange = (open: boolean) => {
		if (!open) form.reset();
		onOpenChange(open);
	};

	const onSubmit = async (json: UpdateVehicleFormData) => {
		if (editorToken === null) return;

		try {
			await updateVehicle({ token: editorToken, json });
			snackbar.enqueueSnackbar(m.vehicle_action_edit_success(), {
				variant: "success",
			});
		} catch {
			snackbar.enqueueSnackbar(
				<>
					{m.vehicle_action_edit_error_line_1()}
					<br />
					{m.vehicle_action_edit_error_line_2()}
				</>,
				{
					variant: "error",
				},
			);
		}

		queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
		queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>{m.vehicle_action_edit_title({ vehicleRef: vehicle.ref })}</DialogTitle>
					<DialogDescription className="text-start text-xs">
						<AlertTriangleIcon className="align-text-bottom inline size-4" />{" "}
						{m.vehicle_action_edit_description_before()}
						<a
							className="font-bold hover:underline"
							href="https://discord.com/channels/1354896116490965316/1407062689531826349/1407068670106009732"
							target="_blank"
							rel="noopener"
						>
							{m.vehicle_action_edit_contribution_rules()}
						</a>{" "}
						{m.vehicle_action_edit_description_after()}
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="number"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{m.vehicle_action_edit_number_label()}</FormLabel>
									<FormControl>
										<Input {...field} value={field.value ?? ""} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="designation"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{m.vehicle_action_edit_designation_label()}</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Mercedes-Benz Citaro C2, Irisbus Citelis 18, ..."
											onChange={(e) => field.onChange(e.target.value || null)}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										{m.vehicle_action_edit_designation_description()}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="tcId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{m.vehicle_action_edit_tc_id_label()}</FormLabel>
									<FormControl>
										<Input
											{...field}
											onChange={(e) => field.onChange(+e.target.value || null)}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										{m.vehicle_action_edit_tc_id_description({ tcId: "7839" })}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{m.vehicle_action_edit_type_label()}</FormLabel>
									<Select
										items={vehicleJourneyLineTypes.map((type) => ({ label: lineTypeLabels[type](), value: type }))}
										onValueChange={field.onChange}
										value={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent className="z-9999">
											<SelectGroup>
												{vehicleJourneyLineTypes.map((type) => (
													<SelectItem key={type} value={type}>
														{lineTypeLabels[type]()}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						{selectableOperators !== undefined && (
							<FormField
								control={form.control}
								name="operatorId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{m.vehicle_action_edit_operator_label()}</FormLabel>
										<Select
											items={selectableOperators}
											onValueChange={(value) =>
												field.onChange(value === noOperatorSelectValue || value === null ? null : +value)
											}
											value={field.value === null ? noOperatorSelectValue : String(field.value)}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder={m.vehicle_action_edit_operator_empty()} />
												</SelectTrigger>
											</FormControl>
											<SelectContent className="z-9999 w-fit">
												<SelectGroup>
													{selectableOperators.map(({ label, value }) => (
														<SelectItem key={value} value={value}>
															{value === noOperatorSelectValue ? (
																<span className="text-muted-foreground">{label}</span>
															) : (
																label
															)}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
						<DialogFooter className="gap-2">
							<DialogClose
								render={
									<Button disabled={updatingVehicle} type="button">
										{m.vehicle_action_cancel()}
									</Button>
								}
							/>
							<Button disabled={updatingVehicle} type="submit" variant="branding-default">
								{m.vehicle_action_edit_save()}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
