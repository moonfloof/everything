export type Optional<T> = T | null;
export type Insert<T> = Omit<T, 'id' | 'updated_at'>;
export type Update<T> = Omit<T, 'device_id' | 'track_id'>;
export type Select<T> = T & { timeago: string };
