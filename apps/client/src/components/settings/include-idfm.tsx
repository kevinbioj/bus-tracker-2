import { AlertTriangleIcon } from "lucide-react";
import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function IncludeIdfmSetting() {
	const id = useId();
	const [includeIdfm, setIncludeIdfm] = useLocalStorage("include-idfm", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id={id} checked={includeIdfm} onCheckedChange={setIncludeIdfm} />
			<Label htmlFor={id}>
				Afficher les lignes Île-de-France Mobilités{" "}
				<span className="text-xs">
					– <AlertTriangleIcon className="inline" height={16} width={16} /> option énergivore
				</span>
			</Label>
		</div>
	);
}
