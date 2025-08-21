import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Copy, KeySquareIcon, LogIn, LogOut, User } from "lucide-react";
import { useSnackbar } from "notistack";
import { type FormEvent, useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { GetEditorSelf } from "~/api/editors";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function EditorTokenInput() {
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();
	const id = useId();

	const [editorToken, setEditorToken] = useLocalStorage<string | null>("editor-token", null);

	const { data: editor, isLoading } = useQuery(GetEditorSelf(editorToken));

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const token = formData.get("token")!.toString();

		try {
			await queryClient.fetchQuery(GetEditorSelf(token));
			setEditorToken(token);
		} catch {
			enqueueSnackbar("Aucun contributeur n'existe avec ce jeton.", { variant: "error" });
		}
	};

	return (
		<div>
			<h2 className="font-bold mb-2">Espace contribution</h2>
			{editor ? (
				<div className="flex justify-between">
					<p>
						<User className="align-text-bottom inline size-5" /> {editor.username}
						<br />
						<span className="text-muted-foreground text-sm">
							Contributeur depuis le {dayjs(editor.createdAt).format("L")}
						</span>
					</p>
					<div className="space-x-2">
						<Button
							onClick={() => {
								navigator.clipboard.writeText(editorToken!);
								enqueueSnackbar("Jeton d'authentification copié dans le presse-papier !", {
									variant: "info",
								});
							}}
							type="button"
							size="icon"
							title="Copier mon jeton"
						>
							<Copy />
						</Button>
						<Button
							onClick={() => setEditorToken(null)}
							type="button"
							variant="destructive"
							size="icon"
							title="Se déconnecter"
						>
							<LogOut />
						</Button>
					</div>
				</div>
			) : (
				<form onSubmit={onSubmit}>
					<Label htmlFor={id}>
						<KeySquareIcon className="align-text-bottom inline size-4" /> Jeton d'authentification éditeur
					</Label>
					<div className="flex gap-2">
						<Input id={id} name="token" defaultValue={editorToken ?? ""} required />
						<Button disabled={isLoading} type="submit" size="icon" title="Se connecter">
							<LogIn />
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
