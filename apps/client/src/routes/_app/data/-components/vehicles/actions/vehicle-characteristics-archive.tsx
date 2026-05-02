import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { useForm } from "react-hook-form";
import z from "zod";

import { ArchiveVehicleMutation, type Vehicle, type VehicleArchiveReason, vehicleArchiveReasons } from "~/api/vehicles";
import { FormCheckbox } from "~/components/form/form-checkbox";
import { FormDateTimePicker } from "~/components/form/form-date-time-picker";
import { FormSelect } from "~/components/form/form-select";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";
import { useEditor } from "~/hooks/use-editor";
import * as m from "~/paraglide/messages";

const schema = z.object({
	reason: z.enum(vehicleArchiveReasons),
	wipeReference: z.boolean(),
	archivedAt: z.string().nullish(),
});

const vehicleArchiveReasonLabels: Record<VehicleArchiveReason, () => string> = {
	FAILURE: m.vehicle_action_archive_reason_failure,
	FIRE: m.vehicle_action_archive_reason_fire,
	RETIRED: m.vehicle_action_archive_reason_retired,
	SOLD: m.vehicle_action_archive_reason_sold,
	TRANSFER: m.vehicle_action_archive_reason_transfer,
	OTHER: m.vehicle_action_archive_reason_other,
};

type VehicleCharacteristicsArchiveProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	vehicle: Vehicle;
};

export function VehicleCharacteristicsArchive({ open, onOpenChange, vehicle }: VehicleCharacteristicsArchiveProps) {
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();
	const { editorToken } = useEditor();

	const form = useForm({
		defaultValues: { reason: "OTHER" as const, wipeReference: false, archivedAt: dayjs().toISOString() },
		resolver: zodResolver(schema),
	});

	const { mutateAsync: archiveVehicle } = useMutation(ArchiveVehicleMutation(vehicle.id));

	if (vehicle.archivedAt !== null) return null;

	const onSubmit = async (json: z.infer<typeof schema>) => {
		if (editorToken === null) return;

		try {
			await archiveVehicle({ json, token: editorToken });

			enqueueSnackbar({ message: m.vehicle_action_archive_success(), variant: "success" });

			queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
			queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
			onOpenChange(false);
		} catch {
			enqueueSnackbar({ message: m.vehicle_action_archive_error(), variant: "error" });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>{m.vehicle_action_archive_title()}</DialogTitle>
				</DialogHeader>
				<div className="text-muted-foreground text-sm">
					{m.vehicle_action_archive_description_intro()}
					<ul className="list-inside list-disc">
						<li>{m.vehicle_action_archive_description_retired()}</li>
						<li>{m.vehicle_action_archive_description_unreal()}</li>
					</ul>
					<br />
					{m.vehicle_action_archive_wipe_warning_before()}
					<span className="font-bold">{m.vehicle_action_archive_wipe_warning_emphasis()}</span>
					{m.vehicle_action_archive_wipe_warning_after()}
				</div>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<FormCheckbox
							control={form.control}
							name="wipeReference"
							label={m.vehicle_action_archive_break_ref({ vehicleRef: vehicle.ref })}
							itemProps={{ className: "mb-5" }}
							inputProps={{
								className: "data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground",
							}}
						/>
						<FormDateTimePicker
							control={form.control}
							name="archivedAt"
							label={m.vehicle_action_archive_date_label()}
							itemProps={{ className: "mb-5" }}
						/>
						<FormSelect
							control={form.control}
							name="reason"
							label={m.vehicle_action_archive_reason_label()}
							options={Object.entries(vehicleArchiveReasonLabels).map(([value, label]) => ({ label: label(), value }))}
							itemProps={{ className: "mb-5" }}
						/>
						<DialogFooter className="gap-3">
							<DialogClose
								render={
									<Button type="button" variant="secondary">
										{m.vehicle_action_cancel()}
									</Button>
								}
							/>
							<Button type="submit" variant="destructive">
								{m.vehicle_action_archive()}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
