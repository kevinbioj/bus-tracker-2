import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useForm } from "react-hook-form";
import z from "zod";

import { ArchiveVehicleMutation, type VehicleArchiveReason, type Vehicle, vehicleArchiveReasons } from "~/api/vehicles";
import { FormCheckbox } from "~/components/form/form-checkbox";
import { FormSelect } from "~/components/form/form-select";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";
import { useEditor } from "~/hooks/use-editor";

const schema = z.object({
	reason: z.enum(vehicleArchiveReasons),
	wipeReference: z.boolean(),
});

const vehicleArchiveReasonLabels: Record<VehicleArchiveReason, string> = {
	FAILURE: "Casse matérielle",
	FIRE: "Incendie",
	RETIRED: "Réforme",
	SOLD: "Vente",
	TRANSFER: "Transfert",
	OTHER: "Autre",
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
		defaultValues: { reason: "OTHER" as const, wipeReference: false },
		resolver: zodResolver(schema),
	});

	const { mutateAsync: archiveVehicle } = useMutation(ArchiveVehicleMutation(vehicle.id));

	if (vehicle.archivedAt !== null) return null;

	const onSubmit = async (json: z.infer<typeof schema>) => {
		if (editorToken === null) return;

		try {
			await archiveVehicle({ json, token: editorToken });

			enqueueSnackbar({ message: "Ce véhicule a été archivé avec succès.", variant: "success" });

			queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
			queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
			onOpenChange(false);
		} catch {
			enqueueSnackbar({ message: "Une erreur est survenue lors de l'archivage du véhicule.", variant: "error" });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
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
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<FormCheckbox
							control={form.control}
							name="wipeReference"
							label={
								<>
									Casser l'association <span className="font-mono">{vehicle.ref}</span> du véhicule
								</>
							}
							itemProps={{ className: "mb-5" }}
							inputProps={{
								className: "data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground",
							}}
						/>
						<FormSelect
							control={form.control}
							name="reason"
							label="Raison de l'archivage"
							options={Object.entries(vehicleArchiveReasonLabels).map(([value, label]) => ({ label, value }))}
							itemProps={{ className: "mb-5" }}
						/>
						<DialogFooter className="gap-3">
							<DialogClose asChild>
								<Button type="button" variant="secondary">
									Annuler
								</Button>
							</DialogClose>
							<Button type="submit" variant="destructive">
								Archiver
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
