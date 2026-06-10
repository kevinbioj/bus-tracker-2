import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useState } from "react";

import { DeleteGirouetteMutation, type Girouette, ToggleGirouetteEnabledMutation } from "~/api/girouettes";
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
import { Girouette as GirouettePreview } from "~/components/vehicles-map/vehicles-markers/popup/girouette";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

type GirouettesTableProps = {
	girouettes: Girouette[];
	lineId: number;
};

const directionSortKey = (directionId: number | null) => (directionId === null ? 0 : directionId + 1);

export function GirouettesTable({ girouettes, lineId }: Readonly<GirouettesTableProps>) {
	const sorted = girouettes.toSorted((a, b) => {
		const dirDiff = directionSortKey(a.directionId) - directionSortKey(b.directionId);
		if (dirDiff !== 0) return dirDiff;
		return (a.destinations[0] ?? "").localeCompare(b.destinations[0] ?? "");
	});

	return (
		<div className="border rounded-lg overflow-x-auto mt-1">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="text-left font-medium px-3 py-2">{m.line_girouettes_column_direction()}</th>
						<th className="text-left font-medium px-3 py-2">{m.line_girouettes_column_destination()}</th>
						<th className="text-left font-medium px-3 py-2">{m.line_girouettes_column_preview()}</th>
						<th className="text-right font-medium px-3 py-2">{m.line_girouettes_column_actions()}</th>
					</tr>
				</thead>
				<tbody>
					{sorted.length === 0 ? (
						<tr>
							<td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
								{m.line_girouettes_empty()}
							</td>
						</tr>
					) : (
						sorted.map((girouette) => <GirouetteRow key={girouette.id} girouette={girouette} lineId={lineId} />)
					)}
				</tbody>
			</table>
		</div>
	);
}

type GirouetteRowProps = {
	girouette: Girouette;
	lineId: number;
};

function GirouetteRow({ girouette, lineId }: Readonly<GirouetteRowProps>) {
	const queryClient = useQueryClient();
	const snackbar = useSnackbar();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const toggleMutation = useMutation({
		...ToggleGirouetteEnabledMutation(girouette.id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lines", lineId, "girouettes"] }),
		onError: () => snackbar.enqueueSnackbar(m.line_girouettes_error(), { variant: "error" }),
	});

	const deleteMutation = useMutation({
		...DeleteGirouetteMutation(girouette.id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lines", lineId, "girouettes"] });
			snackbar.enqueueSnackbar(m.line_girouettes_delete_success(), { variant: "success" });
			setDeleteOpen(false);
		},
		onError: () => snackbar.enqueueSnackbar(m.line_girouettes_error(), { variant: "error" }),
	});

	const directionLabel =
		girouette.directionId === 0
			? m.line_girouettes_direction_outbound()
			: girouette.directionId === 1
				? m.line_girouettes_direction_inbound()
				: m.line_girouettes_direction_any();

	const destinationsLabel =
		girouette.destinations.length > 0 ? girouette.destinations.join(", ") : m.line_girouettes_form_destination_any();

	return (
		<tr className="border-b last:border-b-0" style={{ opacity: girouette.enabled ? 1 : 0.5 }}>
			<td className={cn("px-3 py-2 whitespace-nowrap", girouette.directionId === null && "text-muted-foreground")}>
				{directionLabel}
			</td>
			<td className={cn("px-3 py-2 max-w-40 truncate", girouette.destinations.length === 0 && "text-muted-foreground")}>
				{destinationsLabel}
			</td>
			<td className="px-3">
				<GirouettePreview width={384} {...girouette.data} />
			</td>
			<td className="px-3 py-2">
				<div className="flex items-center justify-end gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						title={girouette.enabled ? m.line_girouettes_disable() : m.line_girouettes_enable()}
						disabled={toggleMutation.isPending}
						onClick={() => toggleMutation.mutate(!girouette.enabled)}
					>
						{girouette.enabled ? <EyeIcon /> : <EyeOffIcon />}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						title={m.line_girouettes_edit()}
						nativeButton={false}
						render={
							<Link
								to="/data/lines/$lineId/girouettes/$girouetteId/edit"
								params={{ lineId: String(lineId), girouetteId: String(girouette.id) }}
							>
								<PencilIcon />
							</Link>
						}
					/>
					<Button variant="ghost" size="icon-sm" title={m.line_girouettes_delete()} onClick={() => setDeleteOpen(true)}>
						<TrashIcon className="text-destructive" />
					</Button>
				</div>

				<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>{m.line_girouettes_delete()}</DialogTitle>
							<DialogDescription>{m.line_girouettes_delete_confirm()}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<DialogClose render={<Button variant="outline">{m.line_girouettes_form_cancel()}</Button>} />
							<Button
								onClick={() => deleteMutation.mutate()}
								disabled={deleteMutation.isPending}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{m.line_girouettes_delete()}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</td>
		</tr>
	);
}
