import { ArchiveIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { Vehicle } from "~/api/vehicles";
import { VehicleCharacteristicsArchive } from "~/routes/_app/data/-components/vehicles/actions/vehicle-characteristics-archive";
import { VehicleCharacteristicsEdit } from "~/routes/_app/data/-components/vehicles/actions/vehicle-characteristics-edit";
import { VehicleCharacteristicsUnarchive } from "~/routes/_app/data/-components/vehicles/actions/vehicle-characteristics-unarchive";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useEditor } from "~/hooks/use-editor";
import * as m from "~/paraglide/messages";

type VehicleCharacteristicsActionsProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristicsActions({ vehicle }: VehicleCharacteristicsActionsProps) {
	const { editor, editorToken } = useEditor();
	const [activeDialog, setActiveDialog] = useState<"edit" | "archive" | "unarchive">();

	const editable = editorToken !== null && (editor?.allowedNetworks.includes(vehicle.networkId) ?? false);
	if (!editable) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" size="icon">
						<MoreHorizontalIcon />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="z-1000">
					<DropdownMenuItem onClick={() => setActiveDialog("edit")}>
						<PencilIcon /> {m.vehicle_action_edit()}
					</DropdownMenuItem>
					{vehicle.archivedAt === null ? (
						<DropdownMenuItem
							className="text-red-600 hover:!text-red-600 hover:!bg-red-600/20"
							onClick={() => setActiveDialog("archive")}
						>
							<Trash2Icon /> {m.vehicle_action_archive()}
						</DropdownMenuItem>
					) : (
						!vehicle.ref.endsWith(":ARCHIVED") && (
							<DropdownMenuItem onClick={() => setActiveDialog("unarchive")}>
								<ArchiveIcon /> {m.vehicle_action_unarchive()}
							</DropdownMenuItem>
						)
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<VehicleCharacteristicsEdit
				open={activeDialog === "edit"}
				onOpenChange={(open) => setActiveDialog(open ? "edit" : undefined)}
				vehicle={vehicle}
			/>
			<VehicleCharacteristicsArchive
				open={activeDialog === "archive"}
				onOpenChange={(open) => setActiveDialog(open ? "archive" : undefined)}
				vehicle={vehicle}
			/>
			<VehicleCharacteristicsUnarchive
				open={activeDialog === "unarchive"}
				onOpenChange={(open) => setActiveDialog(open ? "unarchive" : undefined)}
				vehicle={vehicle}
			/>
		</>
	);
}
