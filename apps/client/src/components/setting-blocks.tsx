import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { Switch } from "~/components/ui/switch";

export const settingIconClasses = "size-5 shrink-0 text-muted-foreground";

export const settingOptionClasses =
	"flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function settingOptionStateClasses(selected: boolean) {
	return selected
		? "border-branding bg-branding/10 text-foreground"
		: "border-border text-muted-foreground hover:bg-muted";
}

export function SettingSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
	return (
		<section>
			<h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
			<div className="divide-y overflow-hidden rounded-lg border">{children}</div>
		</section>
	);
}

export function SettingLabel({
	icon,
	label,
	description,
}: Readonly<{ icon?: ReactNode; label: string; description?: string }>) {
	return (
		<span className="flex items-center gap-3">
			{icon}
			<span className="grid gap-0.5">
				<span className="text-sm leading-snug">{label}</span>
				{description !== undefined && <span className="text-xs leading-snug text-muted-foreground">{description}</span>}
			</span>
		</span>
	);
}

function SettingNested({ children }: Readonly<{ children: ReactNode }>) {
	return <div className="border-t border-dashed bg-muted/40 pl-8">{children}</div>;
}

type SettingFieldProps = {
	icon?: ReactNode;
	label: string;
	description?: string;
	children: ReactNode;
	nested?: ReactNode;
};

export function SettingField({ icon, label, description, children, nested }: Readonly<SettingFieldProps>) {
	return (
		<div>
			<fieldset className="min-w-0 p-3">
				{icon !== undefined ? (
					<legend className="float-left mb-2 w-full">
						<SettingLabel description={description} icon={icon} label={label} />
					</legend>
				) : (
					<legend className="float-left mb-1.5 w-full text-xs font-medium text-muted-foreground">{label}</legend>
				)}
				<div className="clear-both">{children}</div>
			</fieldset>
			{nested ? <SettingNested>{nested}</SettingNested> : null}
		</div>
	);
}

export type SettingChoiceOption<T extends string> = {
	value: T;
	label: string;
	icon?: LucideIcon;
	example?: string;
};

type SettingChoiceProps<T extends string> = Omit<SettingFieldProps, "children"> & {
	value: T;
	options: readonly SettingChoiceOption<T>[];
	onChange: (value: T) => void;
};

export function SettingChoice<T extends string>({
	value,
	options,
	onChange,
	...field
}: Readonly<SettingChoiceProps<T>>) {
	return (
		<SettingField {...field}>
			<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
				{options.map(({ value: optionValue, label, icon: Icon, example }) => (
					<button
						key={optionValue}
						aria-pressed={value === optionValue}
						className={clsx(settingOptionClasses, settingOptionStateClasses(value === optionValue))}
						type="button"
						onClick={() => onChange(optionValue)}
					>
						{example !== undefined ? (
							<>
								<span className="flex items-center gap-1 text-base font-bold tabular-nums">
									{Icon !== undefined && <Icon className="size-3.5" />}
									{example}
								</span>
								<span className="text-xs leading-tight">{label}</span>
							</>
						) : (
							<>
								{Icon !== undefined && <Icon className="size-4" />}
								<span className="text-xs leading-tight text-balance">{label}</span>
							</>
						)}
					</button>
				))}
			</div>
		</SettingField>
	);
}

type SettingToggleProps = {
	icon: ReactNode;
	label: string;
	description?: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	nested?: ReactNode;
};

/**
 * Réglage à bascule. Le libellé, qui occupe presque toute la ligne, bascule le réglage comme
 * l'interrupteur. Celui-ci reste hors du libellé : imbriqué, un clic le basculerait deux fois.
 */
export function SettingToggle({
	icon,
	label,
	description,
	checked,
	onCheckedChange,
	nested,
}: Readonly<SettingToggleProps>) {
	const switchId = useId();

	return (
		<div>
			<div className="flex items-center gap-3 pr-3 transition-colors hover:bg-muted">
				<label className="flex-1 cursor-pointer py-2.5 pl-3" htmlFor={switchId}>
					<SettingLabel description={description} icon={icon} label={label} />
				</label>
				<Switch checked={checked} id={switchId} onCheckedChange={(checked) => onCheckedChange(checked)} />
			</div>
			{nested ? <SettingNested>{nested}</SettingNested> : null}
		</div>
	);
}
