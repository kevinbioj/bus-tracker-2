export function Signature() {
	return (
		<div className="absolute bottom-2 left-2 opacity-30 hover:opacity-100 transition-opacity z-100">
			<a className="font-sans flex items-center gap-2" href="https://bus-tracker.fr" target="_blank" rel="noopener">
				<img className="size-8" src="/logo.svg" alt="Bus Tracker" />
				<span className="hidden text-center font-bold text-3xl text-branding lg:block select-none">Bus Tracker</span>
			</a>
		</div>
	);
}
