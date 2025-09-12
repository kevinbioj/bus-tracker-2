import type { ComponentProps, ReactNode } from "react";
import type { ControllerProps, FieldValues } from "react-hook-form";

import { Checkbox } from "~/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { cn } from "~/utils/utils";

export type FormCheckbox<T extends FieldValues> = Omit<ControllerProps<T>, "render"> & {
	label: ReactNode;
	inputProps?: ComponentProps<typeof Checkbox>;
	itemProps?: ComponentProps<typeof FormItem>;
	labelProps?: ComponentProps<typeof FormLabel>;
	messageProps?: ComponentProps<typeof FormMessage>;
};

export function FormCheckbox<T extends FieldValues = FieldValues>({
	label,
	inputProps = {},
	itemProps = {},
	labelProps = {},
	messageProps = {},
	...props
}: FormCheckbox<T>) {
	return (
		<FormField
			{...props}
			render={({ field, fieldState }) => (
				<FormItem {...itemProps} className={cn("flex gap-2 items-center", itemProps.className)}>
					<FormControl>
						<Checkbox
							{...inputProps}
							onCheckedChange={(checked) => {
								field.onChange(checked);
								inputProps.onCheckedChange?.(checked);
							}}
							checked={field.value}
						/>
					</FormControl>
					<div>
						<FormLabel {...labelProps}>
							{label}
							{inputProps.required && <span className="text-red-500">*</span>}
						</FormLabel>
						{fieldState.error && <FormMessage {...messageProps}>{fieldState.error.message}</FormMessage>}
					</div>
				</FormItem>
			)}
		/>
	);
}
