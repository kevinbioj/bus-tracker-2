import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { UnarchiveVehicleMutation, type Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useEditor } from "~/hooks/use-editor";
import * as m from "~/paraglide/messages";

type VehicleCharacteristicsUnarchiveProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	vehicle: Vehicle;
};

export function VehicleCharacteristicsUnarchive({
	open,
	onOpenChange,
	vehicle,
}: Readonly<VehicleCharacteristicsUnarchiveProps>) {
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();
	const { editor } = useEditor();

	const { isPending: unarchivingVehicle, mutateAsync: unarchiveVehicle } = useMutation(
		UnarchiveVehicleMutation(vehicle.id),
	);

	const handleUnarchive = async () => {
		if (editor == null) return;

		try {
			await unarchiveVehicle();

			enqueueSnackbar({ message: m.vehicle_action_unarchive_success(), variant: "success" });

			queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
			queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
			onOpenChange(false);
		} catch {
			enqueueSnackbar({ message: m.vehicle_action_unarchive_error(), variant: "error" });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>{m.vehicle_action_unarchive_title()}</DialogTitle>
				</DialogHeader>
				<div className="text-muted-foreground text-sm">{m.vehicle_action_unarchive_confirm()}</div>
				<DialogFooter className="gap-3">
					<DialogClose
						render={
							<Button type="button" variant="secondary" disabled={unarchivingVehicle}>
								{m.vehicle_action_cancel()}
							</Button>
						}
					/>
					<Button type="button" onClick={handleUnarchive} disabled={unarchivingVehicle} variant="branding-default">
						{m.vehicle_action_unarchive()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
