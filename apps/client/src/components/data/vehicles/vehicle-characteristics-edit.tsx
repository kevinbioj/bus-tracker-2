import { vehicleJourneyLineTypeEnum, vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, PencilIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocalStorage } from "usehooks-ts";
import * as z from "zod";
import { useSnackbar } from "notistack";

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
	DialogTrigger,
} from "~/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useState } from "react";

const updateVehicleFormSchema = z.object({
	number: z.string().min(1, "Expected 'number' to be non-empty."),
	designation: z.string().nullable(),
	tcId: z.number().min(1, "Expected 'tcId' to be a valid identifier.").nullable(),
	type: vehicleJourneyLineTypeEnum,
});

type UpdateVehicleFormData = z.infer<typeof updateVehicleFormSchema>;

type VehicleCharacteristicsEditProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristicsEdit({ vehicle }: Readonly<VehicleCharacteristicsEditProps>) {
	const [open, setOpen] = useState(false);
	const [editorToken] = useLocalStorage<string | null>("editor-token", null);
	const queryClient = useQueryClient();
	const { isPending: updatingVehicle, mutateAsync: updateVehicle } = useMutation(UpdateVehicleMutation(vehicle.id));
	const snackbar = useSnackbar();

	const form = useForm<UpdateVehicleFormData>({
		resolver: zodResolver(updateVehicleFormSchema),
	});

	if (editorToken === null) return null;

	const onOpenChange = (open: boolean) => {
		if (open)
			form.reset({
				number: vehicle.number,
				designation: vehicle.designation,
				tcId: vehicle.tcId,
				type: vehicle.type,
			});

		setOpen(open);
	};

	const onSubmit = async (json: UpdateVehicleFormData) => {
		try {
			await updateVehicle({ token: editorToken, json });
			snackbar.enqueueSnackbar("Informations du véhicule enregistrées !", {
				variant: "success",
			});
		} catch {
			snackbar.enqueueSnackbar(
				<>
					Une erreur est survenue lors de l'enregistrement des informations.
					<br />
					Vérifiez la validité du jeton et vos droits d'édition.
				</>,
				{
					variant: "error",
				},
			);
		}

		queryClient.invalidateQueries({ queryKey: ["network-vehicles", vehicle.networkId] });
		queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.id] });
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button size="icon">
					<PencilIcon />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Édition du véhicule <pre className="inline">{vehicle.ref}</pre>
					</DialogTitle>
					<DialogDescription className="text-xs">
						<AlertTriangleIcon className="align-text-bottom inline size-4" /> Merci de prendre connaissance{" "}
						<a className="font-bold hover:underline" href="https://google.fr" target="_blank" rel="noopener">
							des règles de contribution
						</a>{" "}
						avant toute action.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="number"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Numéro du véhicule</FormLabel>
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
									<FormLabel>Dénomination du véhicule</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Mercedes-Benz Citaro C2, Irisbus Citelis 18, ..."
											onChange={(e) => field.onChange(e.target.value || null)}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										Merci de reprendre autant que possible les dénominations TC-Infos.
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
									<FormLabel>Identifiant TC-Infos</FormLabel>
									<FormControl>
										<Input
											{...field}
											onChange={(e) => field.onChange(+e.target.value || null)}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										Exemple : https://tc-infos.fr/vehicule/<span className="font-bold">7839</span>.
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
									<FormLabel>Type de véhicule</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Aucune connexion TC-Infos" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{vehicleJourneyLineTypes.map((type) => (
												<SelectItem key={type} value={type}>
													{type}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<DialogClose asChild>
								<Button disabled={updatingVehicle} type="button">
									Annuler
								</Button>
							</DialogClose>
							<Button disabled={updatingVehicle} type="submit" variant="branding-default">
								Sauvegarder
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
