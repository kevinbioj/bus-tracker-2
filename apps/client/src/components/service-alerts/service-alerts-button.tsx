import { TrafficConeIcon } from "lucide-react";
import { useState } from "react";

import type { ServiceAlert } from "~/api/service-alerts";
import { ServiceAlertsDialog, type ServiceAlertsScope } from "~/components/service-alerts/service-alerts-dialog";
import { InformationChip } from "~/components/vehicles-map/vehicles-markers/popup/information-chip";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

type ServiceAlertsButtonProps = {
	alerts: ServiceAlert[];
	/** Ce que visent les alertes, qui donne son titre à la fenêtre. */
	scope: ServiceAlertsScope;
	/** `sm` dans la rangée d'informations de la pop-up véhicule, `md` ailleurs. */
	size?: "sm" | "md";
	/** Dimensions ajustées à ses voisins. */
	className?: string;
};

/**
 * Info trafic, la même partout : une puce carrée, cône de chantier blanc sur fond orange — dans
 * l'habillage des puces de la pop-up véhicule, type de position en tête — qui ouvre le détail des
 * alertes. Rien sans alerte.
 */
export function ServiceAlertsButton({ alerts, scope, size = "md", className }: Readonly<ServiceAlertsButtonProps>) {
	const [open, setOpen] = useState(false);
	if (alerts.length === 0) return null;

	// Enveloppée : dans un contrôle MapLibre, un bouton qui en suit un autre reçoit une bordure haute.
	return (
		<span className="flex shrink-0">
			<InformationChip
				aria-label={m.service_alerts_count({ count: alerts.length })}
				className={cn(
					"shrink-0 justify-center px-0 bg-orange-600 text-white dark:bg-orange-500",
					size === "md" ? "w-6" : "w-5",
					className,
				)}
				icon={<TrafficConeIcon className="size-full" />}
				size={size}
				title={m.service_alerts_show()}
				onClick={() => setOpen(true)}
			/>
			<ServiceAlertsDialog alerts={alerts} open={open} scope={scope} onOpenChange={setOpen} />
		</span>
	);
}
