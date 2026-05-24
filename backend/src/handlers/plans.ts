import { Env } from '../index';
import * as db from '../db/index';
import {
  HttpError,
  badRequest,
  getDbContext,
  json,
  parseBody,
  readId,
  requireToken
} from './_shared';

const ROOT = new URLPattern({ pathname: '/api/plans' });
const PLAN = new URLPattern({ pathname: '/api/plans/:planId' });
const QUESTIONS = new URLPattern({ pathname: '/api/plans/:planId/questions' });
const QUESTION = new URLPattern({ pathname: '/api/plans/:planId/questions/:questionId' });

export async function handlePlans(req: Request, env: Env): Promise<Response | null> {
  const ctx = getDbContext(env);
  if (ROOT.test(req.url)) return handleRoot(req, ctx, requireToken(req));
  const plan = PLAN.exec(req.url)?.pathname.groups.planId;
  if (plan) return handlePlan(req, ctx, requireToken(req), plan);
  const questions = QUESTIONS.exec(req.url)?.pathname.groups.planId;
  if (questions) return handleQuestions(req, ctx, requireToken(req), questions);
  const question = QUESTION.exec(req.url)?.pathname.groups;
  if (question) {
    return removeQuestion(ctx, requireToken(req), question.planId!, question.questionId!);
  }
  return null;
}

async function handleRoot(req: Request, ctx: db.DbContext, token: string) {
  if (req.method === 'GET') {
    const res = await db.listPlans(ctx, token);
    return json(res.documents.map(toPlanListItem));
  }
  if (req.method === 'POST') {
    const body = await parseBody<{ title?: string }>(req);
    if (!body.title?.trim()) badRequest('INVALID_PLAN', 'Plan title is required');
    const res = await db.createPlan(ctx, token, body.title);
    return json({ planId: readId(res.insertedId) }, 201);
  }
  return null;
}

async function handlePlan(req: Request, ctx: db.DbContext, token: string, planId: string) {
  if (req.method === 'GET') {
    const res = await db.getPlan(ctx, token, planId);
    if (!res.document?.instructorToken || res.document.instructorToken !== token) {
      throw new HttpError(404, 'PLAN_NOT_FOUND', 'Plan not found');
    }
    return json(res.document);
  }
  if (req.method === 'DELETE') {
    const res = await db.deletePlan(ctx, token, planId);
    if (!res.deletedCount) throw new HttpError(404, 'PLAN_NOT_FOUND', 'Plan not found');
    return json({ success: true });
  }
  return null;
}

async function handleQuestions(req: Request, ctx: db.DbContext, token: string, planId: string) {
  if (req.method !== 'POST') return null;
  const question = await parseQuestion(req);
  await db.addQuestionToPlan(ctx, planId, { instructorToken: token, question });
  return json({ questionId: question.questionId }, 201);
}

async function removeQuestion(
  ctx: db.DbContext,
  token: string,
  planId: string,
  questionId: string
) {
  await db.removeQuestionFromPlan(ctx, planId, { instructorToken: token, questionId });
  return json({ success: true });
}

async function parseQuestion(req: Request) {
  const body = await parseBody<Record<string, unknown>>(req);
  const choices = Array.isArray(body.choices) ? body.choices.filter(isString) : [];
  const correct = body.correctChoiceIndex;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const invalidIndex = typeof correct === 'number' && (correct < 0 || correct >= choices.length);
  if (!text || choices.length < 2 || invalidIndex) {
    badRequest('INVALID_QUESTION', 'Question payload is invalid');
  }
  return {
    ...(typeof correct === 'number' ? { correctChoiceIndex: correct } : {}),
    ...(typeof body.timeLimit === 'number' ? { timeLimit: body.timeLimit } : {}),
    choices,
    questionId: `q_${Date.now()}`,
    text
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function toPlanListItem(plan: Record<string, unknown>) {
  return { id: readId(plan._id), title: String(plan.title ?? '') };
}
