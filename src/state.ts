import { Annotation } from "@langchain/langgraph";

export type Domain = "health" | "productivity" | "finance" | "insight";

export interface DomainReport {
  domain: Domain;
  confidence: number;
  summary: string;
  metrics: Record<string, number>;
}

export interface CrossDomainPattern {
  id: string;
  confidence: number;
  domains: Domain[];
  explanation: string;
}

export interface Action {
  action: string;
  params: Record<string, unknown>;
  autoExecute: boolean;
}

function appendList<T>(existing: T[], incoming: T[]): T[] {
  return existing.concat(incoming);
}

export const MindPilotState = Annotation.Root({
  query: Annotation<string>(),

  supervisorsNeeded: Annotation<Domain[]>(),

  sleep: Annotation<Record<string, unknown> | undefined>(),
  activity: Annotation<Record<string, unknown> | undefined>(),
  calendar: Annotation<Record<string, unknown> | undefined>(),
  spending: Annotation<Record<string, unknown> | undefined>(),
  focus: Annotation<Record<string, unknown> | undefined>(),

  domainReports: Annotation<DomainReport[]>({
    reducer: appendList,
    default: () => [],
  }),

  crossDomainPatterns: Annotation<CrossDomainPattern[]>({
    reducer: appendList,
    default: () => [],
  }),

  actions: Annotation<Action[]>({
    reducer: appendList,
    default: () => [],
  }),

  finalResponse: Annotation<string>(),
});

export type MindPilotStateType = typeof MindPilotState.State;

export type MindPilotStateUpdate = typeof MindPilotState.Update;
