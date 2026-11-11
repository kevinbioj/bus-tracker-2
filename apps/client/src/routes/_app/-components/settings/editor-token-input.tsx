import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { KeySquareIcon, LogIn, LogOut, UserIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import type { FormEvent } from "react";

import { GetEditorSelf, loginEditor, logoutEditor } from "~/api/editors";
import { SettingField, SettingLabel, settingIconClasses } from "~/components/setting-blocks";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import * as m from "~/paraglide/messages";

export function EditorTokenInput() {
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();

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

	return editor ? (
		<div className="flex items-center gap-3 py-2.5 pr-3 pl-3">
			<div className="min-w-0 flex-1 wrap-break-words">
				<SettingLabel
					description={m.settings_editor_connected_since({ date: dayjs(editor.createdAt).format("L") })}
					icon={<UserIcon className={settingIconClasses} />}
					label={editor.username}
				/>
			</div>
			<Button size="icon-sm" title={m.settings_editor_logout()} type="button" variant="destructive" onClick={onLogout}>
				<LogOut />
			</Button>
		</div>
	) : (
		<SettingField icon={<KeySquareIcon className={settingIconClasses} />} label={m.settings_editor_token_label()}>
			<form className="flex gap-2" onSubmit={onSubmit}>
				<Input aria-label={m.settings_editor_token_label()} name="token" required />
				<Button disabled={isLoading} size="icon" title={m.settings_editor_login()} type="submit">
					<LogIn />
				</Button>
			</form>
		</SettingField>
	);
}
