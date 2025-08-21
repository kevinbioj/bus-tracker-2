import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "usehooks-ts";

import { GetEditorSelf } from "~/api/editors";

export function useEditor() {
	const [editorToken] = useLocalStorage<string | null>("editor-token", null);
	const { data: editor } = useQuery(GetEditorSelf(editorToken));
	return { editor, editorToken };
}
