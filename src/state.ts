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
  timestamp: Annotation<string>(),
  userId: Annotation<string | undefined>(),
  sessionId: Annotation<string | undefined>(),
  timezone: Annotation<string | undefined>(),
  locale: Annotation<string | undefined>(),
  currency: Annotation<string | undefined>(),
  units: Annotation<"metric" | "imperial" | undefined>(),
  deviceType: Annotation<"mobile" | "desktop" | "tablet" | undefined>(),
  appVersion: Annotation<string | undefined>(),
  platform: Annotation<"ios" | "android" | "web" | undefined>(),
  userAgent: Annotation<string | undefined>(),
  screenResolution: Annotation<string | undefined>(),
  networkType: Annotation<"wifi" | "cellular" | "ethernet" | "offline" | undefined>(),

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
