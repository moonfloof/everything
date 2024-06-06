import type { Request } from 'express';

export interface RequestFrontend<
	Query extends object = Record<string, string>,
	Body extends object = Record<string, string>,
> extends Request<Record<string, string>, string | object, Body, { page: number } & Query> {
	query: { page: number } & Query;
	body: Body;
}
