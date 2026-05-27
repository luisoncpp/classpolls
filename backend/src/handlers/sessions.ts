import { Env } from '../index';
import * as db from '../db';
import {
  HttpError,
  badRequest,
  conflict,
  getDbContext,
  json,
  normalizeDates,
  notFound,
  parseBody,
  readId,
  requireToken
} from './_shared';
import { parseQuestionPayload } from './questionPayload';

const CREATE = new URLPattern({ pathname: '/api/sessions' });
const PUBLIC = new URLPattern({ pathname: '/api/sessions/:roomCode' });
const STATS = new URLPattern({ pathname: '/api/sessions/:roomCode/stats' });
const CUSTOM = new URLPattern({ pathname: '/api/sessions/:roomCode/questions/custom' });
const ACTIVATE = new URLPattern({ pathname: '/api/sessions/:roomCode/questions/:questionId/activate' });
const DEACTIVATE = new URLPattern({ pathname: '/api/sessions/:roomCode/questions/deactivate' });
const VOTE = new URLPattern({ pathname: '/api/sessions/:roomCode/vote' });
const CLOSE = new URLPattern({ pathname: '/api/sessions/:roomCode/close' });
const STUDENT_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export async function handleSessions(req: Request, env: Env): Promise<Response | null> {
  const ctx = getDbContext(env);
  if (CREATE.test(req.url) && req.method === 'POST') return createSession(req, ctx);
  const stats = STATS.exec(req.url)?.pathname.groups.roomCode;
  if (stats && req.method === 'GET') return getStats(req, ctx, stats);
  const custom = CUSTOM.exec(req.url)?.pathname.groups.roomCode;
  if (custom && req.method === 'POST') return addCustomQuestion(req, ctx, custom);
  const activate = ACTIVATE.exec(req.url)?.pathname.groups;
  if (activate && req.method === 'POST') return activateQuestion(req, ctx, activate.roomCode!, activate.questionId!);
  const deactivate = DEACTIVATE.exec(req.url)?.pathname.groups.roomCode;
  if (deactivate && req.method === 'POST') return deactivateQuestion(req, ctx, deactivate);
  const vote = VOTE.exec(req.url)?.pathname.groups.roomCode;
  if (vote && req.method === 'POST') return voteOnQuestion(req, ctx, vote);
  const close = CLOSE.exec(req.url)?.pathname.groups.roomCode;
  if (close && req.method === 'POST') return closeSession(req, ctx, close);
  const roomCode = PUBLIC.exec(req.url)?.pathname.groups.roomCode;
  if (roomCode && req.method === 'GET') return getPublicSession(req, ctx, roomCode);
  return null;
}

async function addCustomQuestion(req: Request, ctx: db.DbContext, roomCode: string) {
  const token = requireToken(req);
  const body = await parseBody<Record<string, unknown>>(req);
  const activate = Boolean(body.activate);
  if (activate) await db.deactivateQuestion(ctx, roomCode, token);
  const question = createQuestion(parseQuestionPayload(body), activate);
  const result = await db.addCustomQuestion(ctx, roomCode, { instructorToken: token, question });
  if (!result.matchedCount) notFound('SESSION_NOT_FOUND', 'Session not found');
  return json({ questionId: question.questionId }, 201);
}

async function activateQuestion(req: Request, ctx: db.DbContext, roomCode: string, questionId: string) {
  const result = await db.activateQuestion(ctx, roomCode, { instructorToken: requireToken(req), questionId });
  if (!result.matchedCount) notFound('SESSION_NOT_FOUND', 'Session not found');
  return json({ success: true });
}

async function closeSession(req: Request, ctx: db.DbContext, roomCode: string) {
  const result = await db.closeSession(ctx, roomCode, requireToken(req));
  if (!result.matchedCount) notFound('SESSION_NOT_FOUND', 'Session not found');
  return json({ success: true });
}

function copyQuestions(questions: Record<string, unknown>[] = []) {
  return questions.map((question) => createQuestion(parseQuestionPayload(question), false, question.questionId as string));
}

function createQuestion(
  payload: { choices: string[]; correctChoiceIndex?: number; text: string; timeLimit?: number },
  active: boolean,
  questionId?: string
) {
  return {
    ...(typeof payload.correctChoiceIndex === 'number' ? { correctChoiceIndex: payload.correctChoiceIndex } : {}),
    ...(active ? { startedAt: new Date() } : {}),
    ...(typeof payload.timeLimit === 'number' ? { timeLimit: payload.timeLimit } : {}),
    choices: payload.choices,
    isActive: active,
    questionId: questionId ?? `q_${crypto.randomUUID()}`,
    text: payload.text,
    votes: {}
  };
}

async function createSession(req: Request, ctx: db.DbContext) {
  const token = requireToken(req);
  const body = await parseBody<{ planId?: string }>(req);
  const plan = body.planId ? await db.getPlanById(ctx, body.planId) : { document: null };
  if (body.planId && plan.document?.instructorToken !== token) {
    throw new HttpError(404, 'PLAN_NOT_FOUND', 'Plan not found');
  }
  const roomCode = generateRoomCode();
  await db.createSession(ctx, token, {
    planId: body.planId,
    questions: copyQuestions(plan.document?.questions),
    roomCode
  });
  return json({ roomCode }, 201);
}

async function deactivateQuestion(req: Request, ctx: db.DbContext, roomCode: string) {
  const result = await db.deactivateQuestion(ctx, roomCode, requireToken(req));
  if (!result.matchedCount) notFound('SESSION_NOT_FOUND', 'Session not found');
  return json({ success: true });
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (value) => alphabet[value % alphabet.length]).join('');
}

async function getPublicSession(req: Request, ctx: db.DbContext, roomCode: string) {
  const session = (await db.getSession(ctx, roomCode)).document;
  if (!session) throw new HttpError(404, 'SESSION_NOT_FOUND', 'Session not found');
  return json(stripPrivateFields(session, new URL(req.url).searchParams.get('studentId')));
}

async function getStats(req: Request, ctx: db.DbContext, roomCode: string) {
  const session = await db.getSessionStats(ctx, requireToken(req), roomCode);
  if (!session.document) throw new HttpError(404, 'SESSION_NOT_FOUND', 'Session not found');
  return json(normalizeDates(session.document));
}

function normalizeQuestion(question: Record<string, unknown>, studentId: string | null) {
  const voteMap = (question.votes as Record<string, number> | undefined) ?? {};
  const base = normalizeDates({ ...question, votes: undefined }) as Record<string, unknown>;
  delete base.votes;
  if (shouldHideCorrectChoice(question)) delete base.correctChoiceIndex;
  if (studentId) base.myVote = voteMap[studentId] ?? null;
  return base;
}

function shouldHideCorrectChoice(question: Record<string, unknown>) {
  return question.isActive !== true || !isQuestionExpired(question, Date.now());
}

function isQuestionExpired(question: Record<string, unknown>, now: number) {
  if (!(question.startedAt instanceof Date) || typeof question.timeLimit !== 'number') return false;
  return question.startedAt.getTime() + question.timeLimit * 1000 <= now;
}

function stripPrivateFields(session: Record<string, unknown>, studentId: string | null) {
  const normalized = normalizeDates(session) as Record<string, unknown>;
  delete normalized._id;
  delete normalized.instructorToken;
  if (session._id) normalized.sessionId = readId(session._id);
  normalized.questions = ((session.questions as Record<string, unknown>[] | undefined) ?? []).map((question) =>
    normalizeQuestion(question, studentId)
  );
  return normalized;
}

async function voteOnQuestion(req: Request, ctx: db.DbContext, roomCode: string) {
  const body = await parseBody<Record<string, unknown>>(req);
  const questionId = readQuestionId(body);
  const session = (await db.getSession(ctx, roomCode)).document;
  const question = getSessionQuestion(session, questionId);
  if (!question || question.isActive !== true || isQuestionExpired(question, Date.now())) {
    conflict('VOTE_EXPIRED', 'Voting window closed');
  }
  const vote = parseVotePayload(body, questionId, question);
  const res = await db.registerVote(ctx, roomCode, vote);
  if (!res.matchedCount) conflict('VOTE_EXPIRED', 'Voting window closed');
  return json({ success: true });
}

function getSessionQuestion(session: Record<string, unknown> | null | undefined, questionId: string) {
  const questions = (session?.questions as Record<string, unknown>[] | undefined) ?? [];
  return questions.find((question) => question.questionId === questionId) ?? null;
}

function parseVotePayload(
  body: Record<string, unknown>,
  questionId: string,
  question: Record<string, unknown>
) {
  const choiceIndex = body.choiceIndex as number;
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  const choiceCount = Array.isArray(question.choices) ? question.choices.length : 0;
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choiceCount || !isValidStudentId(studentId)) {
    badRequest('INVALID_VOTE', 'Vote payload is invalid');
  }
  return { choiceIndex, questionId, studentId };
}

function isValidStudentId(studentId: string) {
  return STUDENT_ID_PATTERN.test(studentId)
    && !studentId.includes('.')
    && !studentId.includes('$')
    && !studentId.includes('\0');
}

function readQuestionId(body: Record<string, unknown>) {
  if (typeof body.questionId !== 'string' || !body.questionId) {
    badRequest('INVALID_VOTE', 'Vote payload is invalid');
  }
  return body.questionId;
}
