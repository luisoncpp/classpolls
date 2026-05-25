import { MongoServerError, ObjectId } from 'mongodb';
import { DbContext, resetClient, withDatabase } from './Private/client';

export type { DbContext };
export { resetClient };

type InstructorProfile = {
  email?: string;
  instructorToken: string;
  name?: string;
  picture?: string;
};

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

function objectId(value: string): ObjectId {
  return new ObjectId(value);
}

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof MongoServerError) return false;
  return /connection|socket|server selection|topology|closed|timed out/i.test(error.message);
}

async function withRetry<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    await resetClient();
    return work();
  }
}

export async function getInstructorByGoogleId(ctx: DbContext, googleId: string) {
  return withRetry(async () => ({
    document: await withDatabase(ctx, (db) => db.collection('instructors').findOne({ googleId }))
  }));
}

export async function upsertInstructor(ctx: DbContext, googleId: string, profile: InstructorProfile) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('instructors').updateOne(
        { googleId },
        {
          $set: { email: profile.email, name: profile.name, picture: profile.picture },
          $setOnInsert: { createdAt: new Date(), googleId, instructorToken: profile.instructorToken }
        },
        { upsert: true }
      )
    )
  );
}

export async function listPlans(ctx: DbContext, instructorToken: string) {
  return withRetry(async () => {
    const documents = await withDatabase(ctx, (db) =>
      db.collection('plans').find({ instructorToken }, { projection: { title: 1 } }).toArray()
    );
    return { documents };
  });
}

export async function createPlan(ctx: DbContext, token: string, title: string) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('plans').insertOne({ instructorToken: token, questions: [], title })
    )
  );
}

export async function getPlan(ctx: DbContext, token: string, planId: string) {
  return withRetry(async () => ({
    document: await withDatabase(ctx, (db) =>
      db.collection('plans').findOne({ _id: objectId(planId), instructorToken: token })
    )
  }));
}

export async function getPlanById(ctx: DbContext, planId: string) {
  return withRetry(async () => ({
    document: await withDatabase(ctx, (db) => db.collection('plans').findOne({ _id: objectId(planId) }))
  }));
}

export async function deletePlan(ctx: DbContext, token: string, planId: string) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('plans').deleteOne({ _id: objectId(planId), instructorToken: token })
    )
  );
}

export async function addQuestionToPlan(
  ctx: DbContext,
  planId: string,
  update: { instructorToken: string; question: Record<string, unknown> }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('plans').updateOne(
        { _id: objectId(planId), instructorToken: update.instructorToken },
        { $push: { questions: update.question } } as any
      )
    )
  );
}

export async function removeQuestionFromPlan(
  ctx: DbContext,
  planId: string,
  update: { instructorToken: string; questionId: string }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('plans').updateOne(
        { _id: objectId(planId), instructorToken: update.instructorToken },
        { $pull: { questions: { questionId: update.questionId } } } as any
      )
    )
  );
}

export async function createSession(
  ctx: DbContext,
  token: string,
  session: { planId?: string; questions: SessionQuestion[]; roomCode: string }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').insertOne({
        createdAt: new Date(),
        instructorToken: token,
        planId: session.planId,
        questions: session.questions,
        roomCode: session.roomCode,
        status: 'active'
      })
    )
  );
}

export async function getSession(ctx: DbContext, roomCode: string) {
  return withRetry(async () => ({
    document: await withDatabase(ctx, (db) => db.collection('sessions').findOne({ roomCode }))
  }));
}

export async function getSessionStats(ctx: DbContext, token: string, roomCode: string) {
  return withRetry(async () => ({
    document: await withDatabase(ctx, (db) =>
      db.collection('sessions').findOne({ instructorToken: token, roomCode })
    )
  }));
}

export async function addCustomQuestion(
  ctx: DbContext,
  roomCode: string,
  payload: { instructorToken: string; question: SessionQuestion }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').updateOne(
        { instructorToken: payload.instructorToken, roomCode, status: 'active' },
        { $push: { questions: payload.question } } as any
      )
    )
  );
}

export async function activateQuestion(
  ctx: DbContext,
  roomCode: string,
  payload: { instructorToken: string; questionId: string }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').updateOne(
        { instructorToken: payload.instructorToken, roomCode, status: 'active' },
        {
          $set: {
            'questions.$[others].isActive': false,
            'questions.$[target].isActive': true,
            'questions.$[target].startedAt': new Date()
          }
        },
        {
          arrayFilters: [
            { 'target.questionId': payload.questionId },
            { 'others.questionId': { $ne: payload.questionId } }
          ]
        }
      )
    )
  );
}

export async function deactivateQuestion(ctx: DbContext, roomCode: string, instructorToken: string) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').updateOne(
        { instructorToken, roomCode, status: 'active' },
        { $set: { 'questions.$[q].isActive': false } },
        { arrayFilters: [{ 'q.isActive': true }] }
      )
    )
  );
}

export async function registerVote(
  ctx: DbContext,
  roomCode: string,
  vote: { choiceIndex: number; questionId: string; studentId: string }
) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').updateOne(
        { roomCode, status: 'active' },
        { $set: { [`questions.$[q].votes.${vote.studentId}`]: vote.choiceIndex } },
        { arrayFilters: [{ 'q.isActive': true, 'q.questionId': vote.questionId }] }
      )
    )
  );
}

export async function closeSession(ctx: DbContext, roomCode: string, instructorToken: string) {
  return withRetry(async () =>
    withDatabase(ctx, (db) =>
      db.collection('sessions').updateOne(
        { instructorToken, roomCode, status: 'active' },
        { $set: { status: 'closed' } }
      )
    )
  );
}
