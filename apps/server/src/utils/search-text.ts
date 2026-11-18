export function normalizeSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, " ")
		.trim();
}

export function escapeLikePattern(value: string) {
	return value.replace(/[\\%_]/g, "\\$&");
}

export function matchesSearchText(fields: (string | null | undefined)[], query: string) {
	const needle = normalizeSearchText(query);
	if (needle === "") return true;

	const haystacks = fields.flatMap((field) => (field ? [normalizeSearchText(field)] : []));
	if (haystacks.some((haystack) => haystack.includes(needle))) return true;

	const words = haystacks.flatMap((haystack) => haystack.split(" "));
	return needle.split(" ").every((queryWord) => words.some((word) => word.startsWith(queryWord)));
}
