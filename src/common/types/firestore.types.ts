export type WhereOp = FirebaseFirestore.WhereFilterOp;
export type OrderDirection = FirebaseFirestore.OrderByDirection;

export type WhereTuple = [string, WhereOp, unknown];

export type QueryOptions = {
  where?: WhereTuple[];
  orderBy?: [string, OrderDirection?][];
  limit?: number;
  startAfter?: unknown;
  select?: string[];
};

export type UpsertOptions = {
  id?: string;
  merge?: boolean;
};
