import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useId, useState } from "react";

import { ArchiveVehicleMutation, type Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { useEditor } from "~/hooks/use-editor";

type VehicleCharacteristicsArchiveProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristicsArchive({ vehicle }: VehicleCharacteristicsArchiveProps) {
	const { editorToken } = useEditor();

	const [open, setOpen] = useState(false);
	const [removeVehicleRef, setRemoveVehicleRef] = useState(false);
	const { enqueueSnackbar } = useSnackbar();
	const removeVehicleRefId = useId();

	const queryClient = useQueryClient();
	const { mutateAsync: archiveVehicle } = useMutation(ArchiveVehicleMutation(vehicle.id));

	const handleArchive = async () => {
		if (editorToken === null) return;

		try {
			await archiveVehicle({
				json: { wipeReference: removeVehicleRef },
				token: editorToken,
			});

			enqueueSnackbar({ message: "Ce véhicule a été archivé avec succès.", variant: "success" });

			queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
			queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
			setOpen(false);
		} catch {
			enqueueSnackbar({ message: "Une erreur est survenue lors de l'archivage du véhicule.", variant: "error" });
		}
	};

	return (
		<>
			<Button disabled={vehicle.archivedAt !== null} onClick={() => setOpen(true)} type="button" variant="destructive">
				{vehicle.archivedAt !== null ? "Véhicule archivé" : "Archiver ce véhicule"}
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent aria-describedby={undefined}>
					<DialogHeader>
						<DialogTitle>Archiver ce véhicule</DialogTitle>
					</DialogHeader>
					<div className="text-muted-foreground text-sm">
						Un véhicule peut être archivé pour les raisons suivantes :
						<ul className="list-inside list-disc">
							<li>
								il est réformé <span className="italic">(TC-Infos fait foi)</span> ;
							</li>
							<li>il ne correspond pas à un réel véhicule du réseau.</li>
						</ul>
						<br />
						Cocher la case ci-dessous <span className="font-bold">uniquement</span> en cas de réforme définitive du
						véhicule.
					</div>
					<div className="flex gap-2">
						<Checkbox
							id={removeVehicleRefId}
							className="data-[state=checked]:bg-destructive"
							checked={removeVehicleRef}
							onCheckedChange={(c) => setRemoveVehicleRef(!!c)}
						/>
						<Label htmlFor={removeVehicleRefId}>
							Casser l'association <span className="font-mono">{vehicle.ref}</span> du véhicule
						</Label>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="secondary">
								Annuler
							</Button>
						</DialogClose>
						<Button onClick={handleArchive} type="button" variant="destructive">
							Archiver
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
