import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import { getLegacyEditorToken } from "~/api/editors";
import type { GirouetteData } from "~/components/vehicles-map/vehicles-markers/popup/girouette";

function getLegacyEditorHeaders() {
	const token = getLegacyEditorToken();
	return token === null ? undefined : { "X-Editor-Token": token };
}

export type Girouette = {
	id: number;
	networkId: number;
	lineId: number | null;
	directionId: number | null;
	destinations: string[];
	data: GirouetteData;
	enabled: boolean;
};

export type GirouetteInput = {
	directionId: number | null;
	destinations: string[];
	data: GirouetteData;
	enabled: boolean;
};

export const GetLineGirouettesQuery = (lineId: number) =>
	queryOptions({
		staleTime: 30_000,
		queryKey: ["lines", lineId, "girouettes"],
		queryFn: () => client.get(`/lines/${lineId}/girouettes`, { headers: getLegacyEditorHeaders() }).json<Girouette[]>(),
	});

export const CreateGirouetteMutation = (lineId: number) =>
	mutationOptions({
		mutationFn: async (json: GirouetteInput) => {
			return client.post(`/lines/${lineId}/girouettes`, { headers: getLegacyEditorHeaders(), json }).json<Girouette>();
		},
	});

export const UpdateGirouetteMutation = (girouetteId: number) =>
	mutationOptions({
		mutationFn: async (json: GirouetteInput) => {
			return client.put(`/girouettes/${girouetteId}`, { headers: getLegacyEditorHeaders(), json }).json<Girouette>();
		},
	});

export const ToggleGirouetteEnabledMutation = (girouetteId: number) =>
	mutationOptions({
		mutationFn: async (enabled: boolean) => {
			return client
				.patch(`/girouettes/${girouetteId}/enabled`, { headers: getLegacyEditorHeaders(), json: { enabled } })
				.json<Girouette>();
		},
	});

export const DeleteGirouetteMutation = (girouetteId: number) =>
	mutationOptions({
		mutationFn: async () => {
			await client.delete(`/girouettes/${girouetteId}`, { headers: getLegacyEditorHeaders() });
		},
	});
