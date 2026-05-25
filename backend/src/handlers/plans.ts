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
import { parseQuestionPayload } from './questionPayload';

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
    return json(toPlanDetail(res.document));
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
  const question = {
    ...parseQuestionPayload(await parseBody<Record<string, unknown>>(req)),
    questionId: `q_${Date.now()}`
  };
  await db.addQuestionToPlan(ctx, planId, { instructorToken: token, question });
  return json({ questionId: question.questionId }, 201);
}

async function removeQuestion(
  ctx: db.DbContext,
  token: string,
  planId: string,
  questionId: string
) {
  const result = await db.removeQuestionFromPlan(ctx, planId, { instructorToken: token, questionId });
  if (!result.modifiedCount) throw new HttpError(404, 'PLAN_NOT_FOUND', 'Plan not found');
  return json({ success: true });
}

function toPlanListItem(plan: Record<string, unknown>) {
  return { id: readId(plan._id), title: String(plan.title ?? '') };
}

function toPlanDetail(plan: Record<string, unknown>) {
  return {
    id: readId(plan._id),
    questions: Array.isArray(plan.questions) ? plan.questions : [],
    title: String(plan.title ?? '')
  };
}
