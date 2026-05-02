import {
	Children,
	type ComponentProps,
	cloneElement,
	createContext,
	isValidElement,
	type ReactElement,
	useContext,
	useId,
} from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
	useFormState,
} from "react-hook-form";

import { Label } from "~/components/ui/label";
import { cn } from "~/utils/cn";

const Form = FormProvider;

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName;
};

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function FormField<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
}

type FormItemContextValue = {
	id: string;
};

const FormItemContext = createContext<FormItemContextValue | null>(null);

function useFormField() {
	const fieldContext = useContext(FormFieldContext);
	const itemContext = useContext(FormItemContext);

	if (fieldContext === null) {
		throw new Error("useFormField should be used within <FormField>");
	}

	if (itemContext === null) {
		throw new Error("useFormField should be used within <FormItem>");
	}

	const { getFieldState } = useFormContext();
	const formState = useFormState({ name: fieldContext.name });
	const fieldState = getFieldState(fieldContext.name, formState);
	const { id } = itemContext;

	return {
		id,
		name: fieldContext.name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		...fieldState,
	};
}

function FormItem({ className, ...props }: ComponentProps<"div">) {
	const id = useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			<div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
		</FormItemContext.Provider>
	);
}

function FormLabel({ className, ...props }: ComponentProps<typeof Label>) {
	const { error, formItemId } = useFormField();

	return (
		<Label
			data-slot="form-label"
			data-error={!!error}
			className={cn("data-[error=true]:text-destructive", className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

type FormControlProps = Omit<ComponentProps<"div">, "children"> & {
	children: ReactElement;
	render?: boolean;
};

function FormControl({ children, render: _render, ...props }: FormControlProps) {
	const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
	const child = Children.only(children);

	if (!isValidElement<Record<string, unknown>>(child)) {
		return null;
	}

	return cloneElement(child, {
		"data-slot": "form-control",
		id: formItemId,
		"aria-describedby": !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`,
		"aria-invalid": !!error,
		...props,
	});
}

function FormDescription({ className, ...props }: ComponentProps<"p">) {
	const { formDescriptionId } = useFormField();

	return (
		<p
			data-slot="form-description"
			id={formDescriptionId}
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function FormMessage({ className, ...props }: ComponentProps<"p">) {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error.message ?? "") : props.children;

	if (!body) {
		return null;
	}

	return (
		<p data-slot="form-message" id={formMessageId} className={cn("text-destructive text-sm", className)} {...props}>
			{body}
		</p>
	);
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField };
