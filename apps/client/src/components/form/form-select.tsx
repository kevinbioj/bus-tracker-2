import type { ComponentProps } from "react";
import type { ControllerProps, FieldValues } from "react-hook-form";

import { FormItem, FormLabel, FormMessage, FormField, FormControl } from "~/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

export type FormSelectOption = {
	label: string;
	value: string;
};

export type FormSelectProps<T extends FieldValues> = Omit<ControllerProps<T>, "render"> & {
	label: string;
	options: FormSelectOption[];
	clearable?: boolean;
	inputProps?: ComponentProps<typeof Select>;
	inputTriggerProps?: ComponentProps<typeof SelectTrigger>;
	inputValueProps?: ComponentProps<typeof SelectValue>;
	itemProps?: ComponentProps<typeof FormItem>;
	labelProps?: ComponentProps<typeof FormLabel>;
	messageProps?: ComponentProps<typeof FormMessage>;
};

export function FormSelect<T extends FieldValues = FieldValues>({
	label,
	options,
	clearable = true,
	inputProps = {},
	inputTriggerProps = {},
	inputValueProps = {},
	itemProps = {},
	labelProps = {},
	messageProps = {},
	...props
}: FormSelectProps<T>) {
	return (
		<FormField
			{...props}
			render={({ field, fieldState }) => (
				<FormItem {...itemProps}>
					<FormLabel {...labelProps}>
						{label}
						{inputProps.required && <span className="text-red-500">*</span>}
					</FormLabel>
					<Select
						{...inputProps}
						{...field}
						onValueChange={(value) => {
							field.onChange(value);
							inputProps.onValueChange?.(value);
						}}
						value={field.value}
					>
						<FormControl>
							<SelectTrigger {...inputTriggerProps}>
								<SelectValue {...inputValueProps} />
							</SelectTrigger>
						</FormControl>
						<SelectContent className="z-10000">
							{options.map(({ label, value }) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{fieldState.error && <FormMessage {...messageProps}>{fieldState.error.message}</FormMessage>}
				</FormItem>
			)}
		/>
	);
}
