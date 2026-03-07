import type { ComponentProps } from "react";
import type { ControllerProps, FieldValues } from "react-hook-form";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";

import { cn } from "~/utils/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";

export type FormDateTimePickerProps<T extends FieldValues> = Omit<ControllerProps<T>, "render"> & {
	label: string;
	placeholder?: string;
	itemProps?: ComponentProps<typeof FormItem>;
	labelProps?: ComponentProps<typeof FormLabel>;
	messageProps?: ComponentProps<typeof FormMessage>;
};

export function FormDateTimePicker<T extends FieldValues = FieldValues>({
	label,
	placeholder = "Choisir une date",
	itemProps = {},
	labelProps = {},
	messageProps = {},
	...props
}: FormDateTimePickerProps<T>) {
	return (
		<FormField
			{...props}
			render={({ field }) => {
				const value = field.value ? dayjs(field.value) : null;
				const dateValue = value?.toDate();
				const timeValue = value?.format("HH:mm") ?? "";

				return (
					<FormItem {...itemProps}>
						<FormLabel {...labelProps}>{label}</FormLabel>
						<div className="flex gap-3">
							<Popover>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											className={cn("flex-1 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
										>
											{field.value ? value?.format("DD/MM/YYYY") : <span>{placeholder}</span>}
											<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="z-10000 w-auto overflow-hidden p-0" align="start">
									<Calendar
										mode="single"
										selected={dateValue}
										captionLayout="dropdown"
										onSelect={(date) => {
											if (!date) return;
											const newDate = dayjs(date);
											const current = field.value ? dayjs(field.value) : dayjs();
											const updated = newDate.hour(current.hour()).minute(current.minute()).second(0).millisecond(0);
											field.onChange(updated.toISOString());
										}}
									/>
								</PopoverContent>
							</Popover>
							<FormControl>
								<Input
									type="time"
									className="w-auto appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
									step="1"
									value={timeValue}
									onChange={(e) => {
										const timeStr = e.target.value;
										if (!timeStr) return;
										const [hours, minutes] = timeStr.split(":").map(Number);
										const current = field.value ? dayjs(field.value) : dayjs();
										const updated = current.hour(hours).minute(minutes).second(0).millisecond(0);
										field.onChange(updated.toISOString());
									}}
								/>
							</FormControl>
						</div>
						<FormMessage {...messageProps} />
					</FormItem>
				);
			}}
		/>
	);
}
