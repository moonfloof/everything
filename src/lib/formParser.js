const formBodyParser = (body) => {
	if (typeof body !== 'string' || body.length === 0) return;

	return body
		.split('&')
		.reduce((acc, field) => {
			let [ key, value ] = field.split('=');
			key = decodeURIComponent(key.replace(/\+/g, ' '));
			value = decodeURIComponent(value.replace(/\+/g, ' '));

			return {
				...acc,
				[key]: value,
			};
		}, {});
};

export default formBodyParser;
