const formBodyParser = (body) => {
	if (typeof body !== 'string' || body.length === 0) return;

	return body
		.split('&')
		.reduce((acc, field) => {
			console.log(field);
			let [ key, value ] = field.split('=');
			key = decodeURIComponent(key.replace('+', ' '));
			value = decodeURIComponent(value.replace('+', ' '));

			return {
				...acc,
				[key]: value,
			};
		}, {});
};

export default formBodyParser;
