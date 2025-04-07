// ⚠ Note: I would not normally rely on regex like this.
// It's unsafe, but considering the *only* use of this function is content I've
// generated myself, I didn't mind in this specific instance.
export function unsafe_stripTags(input: string): string {
	const output = input
		.replace(/<[^>]+?>/g, ' ')
		.replace(/\s{1,}/g, ' ')
		.trim();

	return output;
}

export function shortSummary(input: string): string {
	const maxLength = 160;

	if (input.length < maxLength) {
		return input;
	}

	return `${input.slice(0, maxLength - 3)}...`;
}
