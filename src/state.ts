/**
 * state.ts — The single shared object that flows through the whole graph.
 * =====================================================================
 *
 * In a multi-agent graph, every agent (node) receives the current state,
 * does its work, and returns a *partial* state — just the field(s) it owns.
 * LangGraph merges that partial back into the whole. So this file is the
 * single source of truth for "what data exists in the system."
 *
 * The one design decision that matters most here:
 *
 *   - Most fields are written by exactly ONE agent. For those we want the
 *     normal behavior: the new value REPLACES the old one. (last-write-wins)
 *
 *   - A few fields are written by MANY agents running IN PARALLEL
 *     (e.g. all four supervisors push into `domainReports` at the same time).
 *     If those used last-write-wins, the supervisors would overwrite each
 *     other and we'd lose reports. For those fields we use a "reducer" that
 *     APPENDS instead of replaces.
 *
 * In the Python version this was `Annotated[list, operator.add]`.
 * In LangGraph.js the equivalent is `Annotation<T>({ reducer, default })`.
 */

import { Annotation } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// 1. The small data shapes that get passed around inside the state.
//    These are plain TypeScript types — no LangGraph magic yet.
// ---------------------------------------------------------------------------

/** Which Tier-1 supervisor a report came from. */
export type Domain = "health" | "productivity" | "finance" | "insight";

/**
 * A structured report produced by ONE supervisor about ONE domain.
 * Example: the health supervisor emits a DomainReport summarizing sleep
 * + activity with a single confidence score.
 */
export interface DomainReport {
  domain: Domain;
  /** 0..1 — how confident the supervisor is in this report. */
  confidence: number;
  /** Human-readable headline, e.g. "Budget drift +39% — food_delivery is the driver". */
  summary: string;
  /** Raw numbers the supervisor wants to expose (kept loose on purpose). */
  metrics: Record<string, number>;
}

/**
 * A pattern that spans MORE THAN ONE domain — the thing no single agent
 * could see alone. Produced only by the insight supervisor.
 * Example: "evening meetings → sleep disruption → late-night spending".
 */
export interface CrossDomainPattern {
  /** Stable id for the pattern type, e.g. "stress_spending_loop". */
  id: string;
  /** 0..1 — correlation/confidence behind the pattern. */
  confidence: number;
  /** The domains this pattern connects. */
  domains: Domain[];
  /** Plain-English explanation shown to the user. */
  explanation: string;
}

/**
 * Something MindPilot wants to DO on the user's behalf.
 *
 * The safety boundary lives in `autoExecute`:
 *   - true  → reversible action, run it immediately (e.g. set a reminder)
 *   - false → irreversible action, ask the user first (e.g. decline a meeting)
 */
export interface Action {
  /** Machine name of the action, e.g. "block_calendar_time". */
  action: string;
  /** Parameters for the action handler. */
  params: Record<string, unknown>;
  /** Reversible? If true MindPilot may run it without asking. */
  autoExecute: boolean;
}

// ---------------------------------------------------------------------------
// 2. A reusable reducer for "parallel agents append to one list".
//    This is the TypeScript stand-in for Python's operator.add on lists.
// ---------------------------------------------------------------------------

/**
 * Given the existing list and the new chunk an agent returned, produce the
 * merged list. We simply concatenate, so parallel writers never clobber
 * each other — every contribution is kept.
 */
function appendList<T>(existing: T[], incoming: T[]): T[] {
  return existing.concat(incoming);
}

// ---------------------------------------------------------------------------
// 3. The state schema itself.
//    Annotation.Root({...}) describes every field that can exist in the
//    graph. LangGraph reads this to know how to merge each field.
// ---------------------------------------------------------------------------

export const MindPilotState = Annotation.Root({
  // --- Input -------------------------------------------------------------
  /**
   * The user's natural-language question, e.g. "How was my week?".
   * Written once by the entry point; default reducer (overwrite) is fine.
   */
  query: Annotation<string>(),

  // --- Routing (set by the orchestrator's plan phase) --------------------
  /**
   * Which supervisor branches the orchestrator decided to activate for this
   * query. "How is my sleep?" → ["health"]; "How was my week?" → all three.
   * Drives the conditional fan-out in the graph.
   */
  supervisorsNeeded: Annotation<Domain[]>(),

  // --- Worker outputs (Tier 2) -------------------------------------------
  // Each worker writes exactly ONE of these, so last-write-wins is correct.
  // They are optional because a given query may not activate every worker.
  /** Sleep analyst output (efficiency, debt, anomalies...). */
  sleep: Annotation<Record<string, unknown> | undefined>(),
  /** Activity tracker output (steps, load, anomalies...). */
  activity: Annotation<Record<string, unknown> | undefined>(),
  /** Calendar analyst output (load score, evening meetings...). */
  calendar: Annotation<Record<string, unknown> | undefined>(),
  /** Spending analyst output (z-scores, stress sessions...). */
  spending: Annotation<Record<string, unknown> | undefined>(),

  // --- Aggregated results (Tier 1, written in parallel) ------------------
  /**
   * One entry per supervisor. Supervisors run in parallel, so this MUST
   * append rather than overwrite — hence the custom reducer.
   * (Python: domain_reports: Annotated[list[DomainReport], operator.add])
   */
  domainReports: Annotation<DomainReport[]>({
    reducer: appendList,
    default: () => [],
  }),

  /**
   * Cross-domain patterns. Only the insight supervisor writes these today,
   * but we still use append so adding more pattern-producing agents later
   * stays safe with zero changes here.
   */
  crossDomainPatterns: Annotation<CrossDomainPattern[]>({
    reducer: appendList,
    default: () => [],
  }),

  // --- Final output (Tier 0 synthesize phase) ----------------------------
  /**
   * Actions MindPilot intends to take. Built up during synthesis; append so
   * multiple sources can contribute actions without overwriting.
   */
  actions: Annotation<Action[]>({
    reducer: appendList,
    default: () => [],
  }),

  /** The final natural-language answer shown to the user. Written once. */
  finalResponse: Annotation<string>(),
});

/**
 * Convenience type: the fully-merged state object, as seen *inside* a node.
 * Use this to type a node's `state` parameter.
 *   function myNode(state: MindPilotStateType) { ... }
 */
export type MindPilotStateType = typeof MindPilotState.State;

/**
 * Convenience type: a valid *partial* update a node may return.
 * A node only returns the fields it owns, so every field is optional.
 *   function myNode(state: MindPilotStateType): MindPilotStateUpdate { ... }
 */
export type MindPilotStateUpdate = typeof MindPilotState.Update;
