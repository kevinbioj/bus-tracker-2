#!/bin/sh
set -eu

workspace="$1"
directory="$2"
release_name="$3"
release_version="${4:-dev}"

if [ ! -d "$directory" ]; then
	echo "Cannot upload PostHog source maps because \"$directory\" does not exist."
	exit 1
fi

directory="$(cd "$directory" && pwd)"

if [ -z "${POSTHOG_CLI_API_KEY:-}" ] && [ -s /run/secrets/posthog_cli_api_key ]; then
	POSTHOG_CLI_API_KEY="$(cat /run/secrets/posthog_cli_api_key)"
	export POSTHOG_CLI_API_KEY
fi

if [ -z "${POSTHOG_CLI_PROJECT_ID:-}" ] && [ -s /run/secrets/posthog_cli_project_id ]; then
	POSTHOG_CLI_PROJECT_ID="$(cat /run/secrets/posthog_cli_project_id)"
	export POSTHOG_CLI_PROJECT_ID
fi

if [ -z "${POSTHOG_CLI_HOST:-}" ] && [ -s /run/secrets/posthog_cli_host ]; then
	POSTHOG_CLI_HOST="$(cat /run/secrets/posthog_cli_host)"
	export POSTHOG_CLI_HOST
fi

if [ -n "${POSTHOG_CLI_API_KEY:-}" ] && [ -n "${POSTHOG_CLI_PROJECT_ID:-}" ]; then
	pnpm -C "$workspace" exec posthog-cli sourcemap process \
		--directory "$directory" \
		--release-name "$release_name" \
		--release-version "$release_version" \
		--delete-after
else
	echo "Skipping PostHog sourcemap upload because POSTHOG_CLI_API_KEY or POSTHOG_CLI_PROJECT_ID is missing."
	find "$directory" -name '*.map' -delete
fi
