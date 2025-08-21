import { queryOptions } from "@tanstack/react-query";
import { client } from "~/api/client";

export const EDITOR_TOKEN_HEADER = "X-Editor-Token";

export type Editor = {
	id: number;
	username: string;
	lastSeenAt: string | null;
	allowedNetworks: number[];
	createdAt: string;
};

export const GetEditorSelf = (token: string | null) =>
	queryOptions({
		queryKey: ["editor", token],
		queryFn: () => {
			if (token === null) return null;
			return client
				.get("editors/@me", { headers: { [EDITOR_TOKEN_HEADER]: token } })
				.then((response) => response.json<Editor>());
		},
		retry: false,
	});
