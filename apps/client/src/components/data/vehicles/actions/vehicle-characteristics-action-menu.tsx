import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { Vehicle } from "~/api/vehicles";
import { VehicleCharacteristicsArchive } from "~/components/data/vehicles/actions/vehicle-characteristics-archive";
import { VehicleCharacteristicsEdit } from "~/components/data/vehicles/actions/vehicle-characteristics-edit";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useEditor } from "~/hooks/use-editor";

type VehicleCharacteristicsActionsProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristicsActions({ vehicle }: VehicleCharacteristicsActionsProps) {
	const { editor, editorToken } = useEditor();
	const [activeDialog, setActiveDialog] = useState<"edit" | "archive">();

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
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setActiveDialog("edit")}>
						<PencilIcon /> Éditer
					</DropdownMenuItem>
					{vehicle.archivedAt === null && (
						<DropdownMenuItem
							className="text-red-600 hover:!text-red-600 hover:!bg-red-600/20"
							onClick={() => setActiveDialog("archive")}
						>
							<Trash2Icon /> Archiver
						</DropdownMenuItem>
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
		</>
	);
}
