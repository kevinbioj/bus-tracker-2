import { KeySquareIcon } from "lucide-react";
import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function EditorTokenInput() {
	const id = useId();
	const [editorToken, setEditorToken] = useLocalStorage<string | null>("editor-token", null);

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>
				<KeySquareIcon className="align-text-bottom inline size-4" /> Jeton d'authentification éditeur
			</Label>
			<Input id={id} value={editorToken ?? ""} onChange={(e) => setEditorToken(e.target.value || null)} />
			<span className="text-muted-foreground text-xs">Laissez vide pour désactiver l'accès éditeur.</span>
		</div>
	);
}
