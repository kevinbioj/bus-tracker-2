import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { UnarchiveVehicleMutation, type Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useEditor } from "~/hooks/use-editor";

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
	const { editorToken } = useEditor();

	const { isPending: unarchivingVehicle, mutateAsync: unarchiveVehicle } = useMutation(
		UnarchiveVehicleMutation(vehicle.id),
	);

	const handleUnarchive = async () => {
		if (editorToken === null) return;

		try {
			await unarchiveVehicle({ token: editorToken });

			enqueueSnackbar({ message: "Ce véhicule a été désarchivé avec succès.", variant: "success" });

			queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
			queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
			onOpenChange(false);
		} catch {
			enqueueSnackbar({ message: "Une erreur est survenue lors du désarchivage du véhicule.", variant: "error" });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>Désarchiver ce véhicule</DialogTitle>
				</DialogHeader>
				<div className="text-muted-foreground text-sm">Êtes-vous sûr de vouloir désarchiver ce véhicule ?</div>
				<DialogFooter className="gap-3">
					<DialogClose asChild>
						<Button type="button" variant="secondary" disabled={unarchivingVehicle}>
							Annuler
						</Button>
					</DialogClose>
					<Button type="button" onClick={handleUnarchive} disabled={unarchivingVehicle} variant="branding-default">
						Désarchiver
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
