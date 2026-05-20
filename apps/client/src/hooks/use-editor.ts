import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

import { GetEditorSelf, getEditorSelf, loginEditor } from "~/api/editors";

let legacyMigrationPromise: Promise<void> | null = null;
let legacyAuthFallbackActive = false;

export function useEditor() {
	const queryClient = useQueryClient();
	const [legacyEditorToken, setLegacyEditorToken] = useLocalStorage<string | null>("editor-token", null);
	const { data: editor, isPending } = useQuery(GetEditorSelf);

	useEffect(() => {
		if (legacyEditorToken === null || legacyMigrationPromise !== null || isPending) return;

		if (editor !== null && editor !== undefined && !legacyAuthFallbackActive) {
			setLegacyEditorToken(null);
			return;
		}

		if (editor !== null) return;

		legacyMigrationPromise = loginEditor(legacyEditorToken)
			.then(async (legacyEditor) => {
				const cookieEditor = await getEditorSelf();
				if (cookieEditor === null) {
					legacyAuthFallbackActive = true;
					queryClient.setQueryData(["editor"], legacyEditor);
					return;
				}

				legacyAuthFallbackActive = false;
				setLegacyEditorToken(null);
				queryClient.setQueryData(["editor"], cookieEditor);
			})
			.catch((error) => {
				if (error instanceof HTTPError && error.response.status === 401) {
					legacyAuthFallbackActive = false;
					setLegacyEditorToken(null);
					queryClient.setQueryData(["editor"], null);
				}
			})
			.finally(() => {
				legacyMigrationPromise = null;
			});
	}, [editor, isPending, legacyEditorToken, queryClient, setLegacyEditorToken]);

	return { editor };
}
