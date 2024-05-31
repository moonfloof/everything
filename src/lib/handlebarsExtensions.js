/**
 * @example <caption>Not Equal</caption>
 * {{#xif value1 '!=' value2}}
 *
 * @example <caption>Or</caption>
 * {{#xif url '||' description}}
 */
export function xif(v1, operator, v2, options) {
	switch (operator) {
		case '!=':
			return v1 !== v2 ? options.fn(this) : options.inverse(this);
		case '<':
			return v1 < v2 ? options.fn(this) : options.inverse(this);
		case '<=':
			return v1 <= v2 ? options.fn(this) : options.inverse(this);
		case '>':
			return v1 > v2 ? options.fn(this) : options.inverse(this);
		case '>=':
			return v1 >= v2 ? options.fn(this) : options.inverse(this);
		case '&&':
			return v1 && v2 ? options.fn(this) : options.inverse(this);
		case '||':
			return v1 || v2 ? options.fn(this) : options.inverse(this);
		default:
			return v1 === v2 ? options.fn(this) : options.inverse(this);
	}
}

export function externalRoot() {
	return process.env.TOMBOIS_SERVER_EXTERNAL_URI;
}

export function person() {
	return process.env.TOMBOIS_PERSON_NAME;
}

export const helpers = {
	xif,
	externalRoot,
	person,
};
