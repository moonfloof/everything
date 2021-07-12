import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en/index.js';

TimeAgo.addDefaultLocale(en);

const timeago = new TimeAgo('en');

export default timeago;
