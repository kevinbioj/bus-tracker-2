import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { KeySquareIcon, LogIn, LogOut, User } from "lucide-react";
import { useSnackbar } from "notistack";
import { type FormEvent, useId } from "react";

import { GetEditorSelf, loginEditor, logoutEditor } from "~/api/editors";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import * as m from "~/paraglide/messages";

export function EditorTokenInput() {
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();
	const id = useId();

	const { data: editor, isLoading } = useQuery(GetEditorSelf);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const token = formData.get("token")!.toString();

		try {
			await loginEditor(token);
			localStorage.removeItem("editor-token");
			await queryClient.invalidateQueries({ queryKey: ["editor"] });
		} catch {
			enqueueSnackbar(m.settings_editor_token_invalid(), { variant: "error" });
		}
	};

	const onLogout = async () => {
		await logoutEditor();
		localStorage.removeItem("editor-token");
		queryClient.setQueryData(["editor"], null);
		await queryClient.invalidateQueries({ queryKey: ["editor"] });
	};

	return (
		<div>
			<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
				{m.settings_contribution_section()}
			</h3>
			{editor ? (
				<div className="flex justify-between">
					<p>
						<User className="align-text-bottom inline size-5" /> {editor.username}
						<br />
						<span className="text-muted-foreground text-sm">
							{m.settings_editor_connected_since({ date: dayjs(editor.createdAt).format("L") })}
						</span>
					</p>
					<div className="space-x-2">
						<Button
							onClick={onLogout}
							type="button"
							variant="destructive"
							size="icon"
							title={m.settings_editor_logout()}
						>
							<LogOut />
						</Button>
					</div>
				</div>
			) : (
				<form onSubmit={onSubmit}>
					<Label className="mb-2" htmlFor={id}>
						<KeySquareIcon className="align-text-bottom inline size-4" /> {m.settings_editor_token_label()}
					</Label>
					<div className="flex gap-2">
						<Input id={id} name="token" required />
						<Button disabled={isLoading} type="submit" size="icon" title={m.settings_editor_login()}>
							<LogIn />
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
