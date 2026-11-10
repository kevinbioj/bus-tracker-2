import type { CallOnDemand } from "@bus-tracker/contracts";
import { Hand, type LucideProps, Phone } from "lucide-react";

import { m } from "~/paraglide/messages";

export const onDemandLabels = {
	PHONE: m.stop_call_on_demand_phone,
	DRIVER: m.stop_call_on_demand_driver,
} as const satisfies Record<CallOnDemand, () => string>;

export function OnDemandIcon({ kind, ...props }: Readonly<LucideProps & { kind: CallOnDemand }>) {
	return kind === "PHONE" ? <Phone fill="currentColor" {...props} /> : <Hand {...props} />;
}
