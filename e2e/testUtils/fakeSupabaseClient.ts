type Row = Record<string, unknown>;

interface CascadeRule {
  table: string;
  column: string;
}

const CASCADE_RULES: Record<string, CascadeRule[]> = {
  events: [
    { table: "event_tags", column: "event_id" },
    { table: "event_reminder_targets", column: "event_id" },
    { table: "event_photos", column: "event_id" },
    { table: "event_comments", column: "event_id" },
    { table: "event_reactions", column: "event_id" },
  ],
};

// ON DELETE SET NULL: the child row is kept, only the foreign key column is cleared.
const SET_NULL_RULES: Record<string, CascadeRule[]> = {
  events: [{ table: "todos", column: "event_id" }],
};

export interface FakeSupabaseClient {
  from: (table: string) => unknown;
  rpc: jest.Mock;
  storage: { from: jest.Mock };
  channel: jest.Mock;
  getTable: (table: string) => Row[];
}

export function createFakeSupabaseClient(seed: Record<string, Row[]> = {}): FakeSupabaseClient {
  const tables: Record<string, Row[]> = {};
  Object.entries(seed).forEach(([table, rows]) => {
    tables[table] = rows.map((row) => ({ ...row }));
  });

  let idCounter = 0;
  function nextId(table: string): string {
    idCounter += 1;
    return `${table}-${idCounter}`;
  }

  function ensureTable(table: string): Row[] {
    if (!tables[table]) {
      tables[table] = [];
    }
    return tables[table];
  }

  function cascadeDelete(table: string, deletedIds: unknown[]) {
    const rules = CASCADE_RULES[table];
    if (!rules) return;
    rules.forEach(({ table: childTable, column }) => {
      const rows = ensureTable(childTable);
      tables[childTable] = rows.filter((row) => !deletedIds.includes(row[column]));
    });
  }

  function setNullOnDelete(table: string, deletedIds: unknown[]) {
    const rules = SET_NULL_RULES[table];
    if (!rules) return;
    rules.forEach(({ table: childTable, column }) => {
      const rows = ensureTable(childTable);
      rows.forEach((row) => {
        if (deletedIds.includes(row[column])) {
          row[column] = null;
        }
      });
    });
  }

  function from(table: string) {
    let pendingInsert: Row[] | null = null;
    let pendingUpdate: Row | null = null;
    let pendingDelete = false;
    const filters: ((row: Row) => boolean)[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let isSingle = false;

    async function execute(): Promise<{ data: unknown; error: { code?: string } | null }> {
      const rows = ensureTable(table);

      if (pendingInsert) {
        const inserted = pendingInsert.map((row) => ({
          id: nextId(table),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        }));
        rows.push(...inserted);
        return { data: isSingle ? inserted[0] : inserted, error: null };
      }

      if (pendingUpdate) {
        const matched = rows.filter((row) => filters.every((f) => f(row)));
        matched.forEach((row) => Object.assign(row, pendingUpdate, { updated_at: new Date().toISOString() }));
        if (isSingle) {
          return matched[0]
            ? { data: matched[0], error: null }
            : { data: null, error: { code: "PGRST116" } };
        }
        return { data: matched, error: null };
      }

      if (pendingDelete) {
        const matched = rows.filter((row) => filters.every((f) => f(row)));
        tables[table] = rows.filter((row) => !filters.every((f) => f(row)));
        cascadeDelete(table, matched.map((row) => row.id));
        setNullOnDelete(table, matched.map((row) => row.id));
        return { data: null, error: null };
      }

      let result = rows.filter((row) => filters.every((f) => f(row)));
      if (orderBy) {
        const { column, ascending } = orderBy;
        result = [...result].sort((a, b) => {
          const av = String(a[column]);
          const bv = String(b[column]);
          if (av < bv) return ascending ? -1 : 1;
          if (av > bv) return ascending ? 1 : -1;
          return 0;
        });
      }
      if (isSingle) {
        return result[0]
          ? { data: result[0], error: null }
          : { data: null, error: { code: "PGRST116" } };
      }
      return { data: result, error: null };
    }

    const builder = {
      insert(payload: Row | Row[]) {
        pendingInsert = Array.isArray(payload) ? payload : [payload];
        return builder;
      },
      update(payload: Row) {
        pendingUpdate = payload;
        return builder;
      },
      delete() {
        pendingDelete = true;
        return builder;
      },
      select() {
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      is(column: string, value: null | boolean) {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      lte(column: string, value: unknown) {
        filters.push((row) => String(row[column]) <= String(value));
        return builder;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => String(row[column]) >= String(value));
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderBy = { column, ascending: opts?.ascending ?? true };
        return builder;
      },
      single() {
        isSingle = true;
        return execute();
      },
      then(
        onFulfilled: (value: { data: unknown; error: { code?: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from,
    rpc: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed.jpg" },
          error: null,
        }),
      })),
    },
    channel: jest.fn(() => {
      const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
      channel.on.mockReturnValue(channel);
      channel.subscribe.mockReturnValue(channel);
      return channel;
    }),
    getTable: (table: string) => ensureTable(table),
  };
}
