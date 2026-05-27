import { DbContext, resetClient } from './Private/client';
import { toInstructorDocument, toPlanDocument, toSessionDocument } from './Private/documents';

export type { DbContext };
export { resetClient };

type InstructorProfile = { email?: string; instructorToken: string; name?: string; picture?: string };
type SessionQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  questionId: string;
  startedAt?: Date;
  text: string;
  timeLimit?: number;
  votes: Record<string, number>;
};
type MutationResult = { matchedCount: number; modifiedCount: number };

function createId() {
  return crypto.randomUUID();
}

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function changes(result: { meta?: { changes?: number } }) {
  return result.meta?.changes ?? 0;
}

async function first(ctx: DbContext, sql: string, ...params: unknown[]) {
  return (await ctx.db.prepare(sql).bind(...params).first()) as Record<string, unknown> | null;
}

async function run(ctx: DbContext, sql: string, ...params: unknown[]) {
  return ctx.db.prepare(sql).bind(...params).run();
}

async function updateQuestions(
  ctx: DbContext,
  sql: string,
  params: unknown[],
  mutate: (questions: SessionQuestion[]) => SessionQuestion[] | null
): Promise<MutationResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await first(ctx, sql, ...params);
    if (!row) return { matchedCount: 0, modifiedCount: 0 };
    const version = Number(row.version ?? 0);
    const next = mutate(JSON.parse(String(row.questions_json ?? '[]')) as SessionQuestion[]);
    if (!next) return { matchedCount: 0, modifiedCount: 0 };
    const result = await run(
      ctx,
      'UPDATE sessions SET questions_json = ?, version = version + 1 WHERE id = ? AND version = ? AND status = ?',
      stringify(next),
      row.id,
      version,
      'active'
    );
    if (changes(result)) return { matchedCount: 1, modifiedCount: 1 };
  }
  return { matchedCount: 0, modifiedCount: 0 };
}

async function updatePlanQuestions(
  ctx: DbContext,
  planId: string,
  instructorToken: string,
  mutate: (questions: Record<string, unknown>[]) => Record<string, unknown>[] | null
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const plan = await first(ctx, 'SELECT questions_json, version FROM plans WHERE id = ? AND instructor_token = ?', planId, instructorToken);
    if (!plan) return { matchedCount: 0, modifiedCount: 0 };
    const next = mutate(JSON.parse(String(plan.questions_json ?? '[]')) as Record<string, unknown>[]);
    if (!next) return { matchedCount: 0, modifiedCount: 0 };
    const result = await run(
      ctx,
      'UPDATE plans SET questions_json = ?, version = version + 1 WHERE id = ? AND instructor_token = ? AND version = ?',
      stringify(next),
      planId,
      instructorToken,
      Number(plan.version ?? 0)
    );
    if (changes(result)) return { matchedCount: 1, modifiedCount: 1 };
  }
  return { matchedCount: 0, modifiedCount: 0 };
}

export async function getInstructorByGoogleId(ctx: DbContext, googleId: string) {
  return { document: toInstructorDocument(await first(ctx, 'SELECT * FROM instructors WHERE google_id = ?', googleId)) };
}

export async function upsertInstructor(ctx: DbContext, googleId: string, profile: InstructorProfile) {
  return run(
    ctx,
    `INSERT INTO instructors (google_id, instructor_token, email, name, picture, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(google_id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`,
    googleId,
    profile.instructorToken,
    profile.email ?? null,
    profile.name ?? null,
    profile.picture ?? null,
    new Date().toISOString()
  );
}

export async function listPlans(ctx: DbContext, instructorToken: string) {
  const result = await ctx.db.prepare('SELECT id, title FROM plans WHERE instructor_token = ? ORDER BY created_at DESC').bind(instructorToken).all();
  return { documents: (result.results ?? []).map((row) => ({ _id: String(row.id ?? ''), title: row.title })) };
}

export async function createPlan(ctx: DbContext, token: string, title: string) {
  const id = createId();
  await run(
    ctx,
    'INSERT INTO plans (id, instructor_token, title, questions_json, created_at, version) VALUES (?, ?, ?, ?, ?, 0)',
    id,
    token,
    title,
    '[]',
    new Date().toISOString()
  );
  return { insertedId: id };
}

export async function getPlan(ctx: DbContext, token: string, planId: string) {
  return { document: toPlanDocument(await first(ctx, 'SELECT * FROM plans WHERE id = ? AND instructor_token = ?', planId, token)) };
}

export async function getPlanById(ctx: DbContext, planId: string) {
  return { document: toPlanDocument(await first(ctx, 'SELECT * FROM plans WHERE id = ?', planId)) };
}

export async function deletePlan(ctx: DbContext, token: string, planId: string) {
  const result = await run(ctx, 'DELETE FROM plans WHERE id = ? AND instructor_token = ?', planId, token);
  return { deletedCount: changes(result) };
}

export async function addQuestionToPlan(ctx: DbContext, planId: string, update: { instructorToken: string; question: Record<string, unknown> }) {
  return updatePlanQuestions(ctx, planId, update.instructorToken, (questions) => [...questions, update.question]);
}

export async function removeQuestionFromPlan(ctx: DbContext, planId: string, update: { instructorToken: string; questionId: string }) {
  return updatePlanQuestions(ctx, planId, update.instructorToken, (questions) => {
    if (!questions.some((question) => question.questionId === update.questionId)) return null;
    return questions.filter((question) => question.questionId !== update.questionId);
  });
}

export async function createSession(ctx: DbContext, token: string, session: { planId?: string; questions: SessionQuestion[]; roomCode: string }) {
  const id = createId();
  await run(ctx, 'INSERT INTO sessions (id, instructor_token, plan_id, questions_json, room_code, status, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', id, token, session.planId ?? null, stringify(session.questions), session.roomCode, 'active', new Date().toISOString());
  return { insertedId: id };
}

export async function getSession(ctx: DbContext, roomCode: string) {
  return { document: toSessionDocument(await first(ctx, 'SELECT * FROM sessions WHERE room_code = ?', roomCode)) };
}

export async function getSessionStats(ctx: DbContext, token: string, roomCode: string) {
  return { document: toSessionDocument(await first(ctx, 'SELECT * FROM sessions WHERE instructor_token = ? AND room_code = ?', token, roomCode)) };
}

export async function addCustomQuestion(ctx: DbContext, roomCode: string, payload: { instructorToken: string; question: SessionQuestion }) {
  return updateQuestions(ctx, 'SELECT id, questions_json, version FROM sessions WHERE instructor_token = ? AND room_code = ? AND status = ?', [payload.instructorToken, roomCode, 'active'], (questions) => [...questions, payload.question]);
}

export async function activateQuestion(ctx: DbContext, roomCode: string, payload: { instructorToken: string; questionId: string }) {
  return updateQuestions(ctx, 'SELECT id, questions_json, version FROM sessions WHERE instructor_token = ? AND room_code = ? AND status = ?', [payload.instructorToken, roomCode, 'active'], (questions) => {
    if (!questions.some((question) => question.questionId === payload.questionId)) return null;
    return questions.map((question) => ({ ...question, isActive: question.questionId === payload.questionId, ...(question.questionId === payload.questionId ? { startedAt: new Date() } : {}) }));
  });
}

export async function deactivateQuestion(ctx: DbContext, roomCode: string, instructorToken: string) {
  return updateQuestions(ctx, 'SELECT id, questions_json, version FROM sessions WHERE instructor_token = ? AND room_code = ? AND status = ?', [instructorToken, roomCode, 'active'], (questions) => questions.map((question) => ({ ...question, isActive: false })));
}

export async function registerVote(ctx: DbContext, roomCode: string, vote: { choiceIndex: number; questionId: string; studentId: string }) {
  return updateQuestions(ctx, 'SELECT id, questions_json, version FROM sessions WHERE room_code = ? AND status = ?', [roomCode, 'active'], (questions) => {
    let found = false;
    const next = questions.map((question) => {
      if (!question.isActive || question.questionId !== vote.questionId) return question;
      found = true;
      return { ...question, votes: { ...(question.votes ?? {}), [vote.studentId]: vote.choiceIndex } };
    });
    return found ? next : null;
  });
}

export async function closeSession(ctx: DbContext, roomCode: string, instructorToken: string) {
  const result = await run(ctx, 'UPDATE sessions SET status = ? WHERE instructor_token = ? AND room_code = ? AND status = ?', 'closed', instructorToken, roomCode, 'active');
  return { matchedCount: changes(result), modifiedCount: changes(result) };
}
