type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDate(value: unknown): Date | undefined {
  return typeof value === 'string' ? new Date(value) : undefined;
}

function mapQuestion(question: Record<string, unknown>) {
  const startedAt = toDate(question.startedAt);
  return { ...question, ...(startedAt ? { startedAt } : {}) };
}

export function toInstructorDocument(row: Row | null) {
  if (!row) return null;
  return {
    createdAt: toDate(row.created_at),
    email: row.email,
    googleId: row.google_id,
    instructorToken: row.instructor_token,
    name: row.name,
    picture: row.picture
  };
}

export function toPlanDocument(row: Row | null) {
  if (!row) return null;
  return {
    _id: String(row.id ?? ''),
    createdAt: toDate(row.created_at),
    instructorToken: row.instructor_token,
    questions: parseJson<Record<string, unknown>[]>(row.questions_json, []).map(mapQuestion),
    title: row.title
  };
}

export function toSessionDocument(row: Row | null) {
  if (!row) return null;
  return {
    _id: String(row.id ?? ''),
    createdAt: toDate(row.created_at),
    instructorToken: row.instructor_token,
    planId: row.plan_id ?? undefined,
    questions: parseJson<Record<string, unknown>[]>(row.questions_json, []).map(mapQuestion),
    roomCode: row.room_code,
    status: row.status
  };
}
