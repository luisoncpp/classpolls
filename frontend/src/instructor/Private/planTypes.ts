export type Plan = { id: string; title: string };

export type PlanQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  questionId: string;
  text: string;
  timeLimit?: number;
};

export type PlanDetail = {
  id?: string;
  questions?: PlanQuestion[];
  title: string;
};
