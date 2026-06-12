import { useLocation } from "@tanstack/react-router";
import { Copy, FrownIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";
import * as m from "~/paraglide/messages";

const isWebGLError = (error: unknown) => {
	const msg = String(error);
	return msg.includes("webglcontextcreationerror") || msg.includes("Failed to initialize WebGL");
};

export function PurpleScreenOfDeath({ error }: { error?: unknown }) {
	const pathname = useLocation({ select: (state) => state.pathname });
	const embeddedNetworkId = pathname.startsWith("/embed/") ? pathname.split("/")[2] : undefined;

	const posthog = usePostHog();

	useEffect(() => {
		if (error) {
			console.error(error);
			posthog.captureException(error);
		}
	}, [error, posthog]);

	const resetApp = () => {
		localStorage.clear();
		location.href = embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/";
	};

	const webgl = error !== undefined && isWebGLError(error);

	return (
		<div className="bg-branding text-branding-foreground h-dvh">
			<header className="h-16 p-3 flex justify-center items-center gap-3">
				<img className="h-full" src="/logo.svg" alt="" />
				<span className="text-center font-bold text-3xl select-none hover:cursor-default">Bus Tracker</span>
			</header>
			<main className="px-3 mt-10 text-base">
				<div className="max-w-3xl mx-auto">
					<div className="flex items-center gap-2">
						<FrownIcon className="size-12" />
						<h1 className="font-bold text-3xl">{m.psod_title()}</h1>
					</div>
					{webgl ? (
						<div className="flex flex-col items-start gap-2 mt-3">
							<p>
								{m.psod_webgl_intro()}
								<br />
								{m.psod_webgl_fix()}
							</p>
							<Button
								className="hover:cursor-default"
								variant="on-branding-default"
								nativeButton={false}
								render={<a href={embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/"}>{m.psod_reload()}</a>}
							/>
						</div>
					) : (
						<>
							<div className="flex flex-col items-start gap-2 mt-3">
								<p>
									{m.psod_intro()}
									<br />
									{m.psod_intro_reload()}
								</p>
								<Button
									className="hover:cursor-default"
									variant="on-branding-default"
									nativeButton={false}
									render={<a href={embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/"}>{m.psod_reload()}</a>}
								/>
							</div>
							<div className="flex flex-col items-start gap-2 mt-8">
								<p>{m.psod_persistent()}</p>
								<Button onClick={resetApp} variant="on-branding-default">
									{m.psod_reset()}
								</Button>
							</div>
						</>
					)}
					<div className="flex flex-col items-start gap-2 mt-8">
						<p>
							{m.psod_contact_before()}
							<Link
								className="text-branding-foreground/70 hover:text-branding-foreground/50"
								external
								href="mailto:contact@bus-tracker.fr"
							>
								contact@bus-tracker.fr
							</Link>
							{m.psod_contact_after()}
						</p>
						<div className="border border-neutral-600 rounded-lg bg-neutral-800 p-3 w-full wrap-break-word">
							<div className="flex justify-between">
								<span>{m.psod_error_report()}</span>
								<Button onClick={() => navigator.clipboard.writeText(String(error))} size="sm" variant="ghost">
									<Copy className="size-4" /> {m.psod_copy()}
								</Button>
							</div>
							<div className="font-mono text-neutral-300 mt-0.5">{String(error)}</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
