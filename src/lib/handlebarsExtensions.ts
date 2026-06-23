import type { HelperDeclareSpec, HelperOptions } from 'handlebars';
import { config } from './config/index.js';

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
	return config.serverExternalUri;
}

export function internalRoot() {
	return config.serverInternalUri;
}

export function person() {
	return config.personName;
}

export const helpers: HelperDeclareSpec = {
	xif,
	externalRoot,
	internalRoot,
	person,
};
