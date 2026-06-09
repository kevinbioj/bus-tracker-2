import { XIcon } from "lucide-react";
import { useRef } from "react";

import { cn } from "~/utils/cn";

type ColorPickerProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
};

export function ColorPicker({ value, onChange, placeholder = "#RRGGBB", className }: Readonly<ColorPickerProps>) {
	const colorInputRef = useRef<HTMLInputElement>(null);
	const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);

	const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const raw = e.target.value;
		onChange(raw.startsWith("#") ? raw : raw ? `#${raw}` : "");
	};

	const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

	return (
		<div className={cn("flex items-center gap-1.5", className)}>
			<button
				type="button"
				title="Choisir une couleur"
				onClick={() => colorInputRef.current?.click()}
				className="size-8 shrink-0 rounded-lg border border-input transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
				style={{ backgroundColor: isValidHex ? value : "transparent" }}
			>
				{!isValidHex && (
					<span className="block w-full h-full rounded-lg bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:8px_8px]" />
				)}
			</button>

			<input
				ref={colorInputRef}
				type="color"
				className="sr-only"
				value={isValidHex ? value : "#000000"}
				onChange={handleColorInputChange}
				tabIndex={-1}
			/>

			<input
				type="text"
				value={value}
				onChange={handleTextChange}
				placeholder={placeholder}
				maxLength={7}
				spellCheck={false}
				className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
			/>

			<button
				aria-disabled={!value}
				type="button"
				onClick={() => onChange("")}
				title="Réinitialiser"
				className={cn("shrink-0 text-muted-foreground hover:text-foreground transition-colors", !value && "invisible")}
			>
				<XIcon className="size-4" />
			</button>
		</div>
	);
}
