import type { HelperDeclareSpec, HelperOptions } from 'handlebars';

/**
 * @example <caption>Not Equal</caption>
 * {{#xif value1 '!=' value2}}
 *
 * @example <caption>Or</caption>
 * {{#xif url '||' description}}
 */
export function xif<T>(this: HelperDeclareSpec, v1: T, operator: string, v2: T, options: HelperOptions) {
	let output = false;

	switch (operator) {
		case '!=': {
			output = v1 !== v2;
			break;
		}
		case '<': {
			output = v1 < v2;
			break;
		}
		case '<=': {
			output = v1 <= v2;
			break;
		}
		case '>': {
			output = v1 > v2;
			break;
		}
		case '>=': {
			output = v1 >= v2;
			break;
		}
		case '&&': {
			output = !!v1 && !!v2;
			break;
		}
		case '||': {
			output = !!v1 || !!v2;
			break;
		}
		default: {
			output = v1 === v2;
			break;
		}
	}

	return output ? options.fn(this) : options.inverse(this);
}

export function externalRoot() {
	return process.env.TOMBOIS_SERVER_EXTERNAL_URI;
}

export function person() {
	return process.env.TOMBOIS_PERSON_NAME;
}

export const helpers: HelperDeclareSpec = {
	xif,
	externalRoot,
	person,
};
