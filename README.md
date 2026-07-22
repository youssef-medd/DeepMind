# MindPilot

A personal life operating system built on a 3-tier multi-agent architecture. MindPilot connects your health, productivity, and finance data into a single intelligent layer that detects cross-domain patterns, warns you early, and takes action on your behalf.

> "You sleep worse when you overspend. Your spending spikes after heavy meeting days. No single app can see that — MindPilot can."

---

## What it does

You ask a natural language question. MindPilot fans out to specialized agents across every domain of your life, finds patterns no single app could detect, and responds with both insight and action.

```
You: "How was my week?"

MindPilot: Important pattern detected (71% confidence): Evening meetings →
           sleep disruption → stress spending. Fixing your schedule likely
           reduces your spending.

           Finance (65%): Budget drift +39% — food_delivery is the driver
           Health  (75%): Sleep efficiency 63% — 11h debt this week
           Productivity (90%): 5 evening meetings contributing to disruption

           Actions taken:
             ✓ Set nightly wind-down reminder at 22:00
             ✓ Set evening meeting hard-stop at 19:00

           Waiting for your approval: clear recovery day
```

The system runs three different queries with smart routing — asking about sleep activates only the health branch. Asking about money activates only finance. Asking for a weekly summary activates everything in parallel.

---

## Architecture

### 3-tier agent hierarchy

```
Tier 0 — Master Orchestrator
         Plans intent, routes to supervisors, synthesizes final answer, executes actions

         ├── Tier 1 — Health Supervisor
         │           Detects compound risks across health workers
         │           ├── Tier 2 — Sleep Analyst       (Apple Health API)
         │           └── Tier 2 — Activity Tracker    (Apple Health API)
         │
         ├── Tier 1 — Productivity Supervisor
         │           Detects overload + cross-domain calendar risks
         │           └── Tier 2 — Calendar Analyst    (Google Calendar MCP)
         │
         ├── Tier 1 — Finance Supervisor
         │           Detects stress-spending patterns, budget drift
         │           └── Tier 2 — Spending Analyst    (Plaid API)
         │
         └── Tier 1 — Insight Supervisor  ← runs last, reads everything
                     Cross-domain Pearson correlation
                     Detects patterns no single domain can see
```

**Why 3 tiers?** A flat system with all agents talking to one orchestrator creates an unmanageable context window and no separation of concerns. The hierarchy enforces strict contracts:

- The orchestrator never touches raw data
- Supervisors never call external APIs
- Workers never talk to each other
- Each layer only knows the layer directly above it

### Execution flow for "How was my week?"

```
orchestrator_plan
      │
      ├── sleep_analyst    ─┐
      ├── activity_tracker ─┤→ health_supervisor    ─┐
      ├── calendar_analyst ──→ productivity_supervisor─┤→ insight_supervisor → orchestrator_synthesize
      └── spending_analyst ──→ finance_supervisor    ─┘
```

All workers in the same domain run in parallel. All supervisors run in parallel after their workers complete. The insight supervisor waits for all supervisors, then runs last. LangGraph handles all fan-out and fan-in automatically.

### Smart routing

The orchestrator routes based on query intent, only activating the branches it needs:

| Query                      | Branches activated              | Workers called |
| -------------------------- | ------------------------------- | -------------- |
| "How was my week?"         | health + productivity + finance | 4              |
| "How is my sleep?"         | health only                     | 2              |
| "Why am I broke?"          | health + productivity + finance | 4              |
| "Am I overloaded at work?" | productivity only               | 1              |

This saves API calls, reduces latency, and controls LLM cost.

---

## File structure

```
mindpilot/
├── state.py          # Shared state — the single object that flows through the graph
├── workers.py        # Tier 2 — 4 worker agents, each fetches one data source
├── supervisors.py    # Tier 1 — 4 supervisor agents, domain aggregation + insight
├── orchestrator.py   # Tier 0 — master orchestrator + full LangGraph graph assembly
└── README.md
```

### state.py

Defines `MindPilotState` — the single `TypedDict` shared across all 14 agents. The key design decision: fields that multiple parallel agents write to use `Annotated[list, operator.add]`, which appends instead of overwriting. This is how parallel supervisors safely contribute to `domain_reports` without race conditions.

```python
domain_reports: Annotated[list[DomainReport], operator.add]
cross_domain_patterns: Annotated[list[CrossDomainPattern], operator.add]
```

### workers.py

Four worker agents — `sleep_analyst_agent`, `activity_tracker_agent`, `calendar_analyst_agent`, `spending_analyst_agent`. Each:

1. Calls its mock data source (swap for real APIs)
2. Runs its algorithm (anomaly detection, z-score, load scoring)
3. Returns a partial state dict touching only its own field

Workers are stateless, side-effect-free, and completely isolated from each other.

**Algorithms used:**

- Sleep: efficiency = mean(asleep / in_bed), debt = Σ max(0, 7 − hours_slept)
- Calendar: load_score = mean(meetings_per_day) / working_hours
- Spending: z-score per category against 90-day rolling mean; stress sessions = 3+ transactions after 22:00 within 2h

### supervisors.py

Four supervisor agents. The interesting logic lives here — domain-level combinations that workers cannot compute alone.

Examples:

- **Health supervisor:** applies a compound penalty when both sleep AND activity are anomalous simultaneously (worse than either alone)
- **Insight supervisor:** runs cross-domain pattern detection across all worker outputs. Detects `pre_burnout_v2` (sleep + calendar + spending all bad → crash in 3–5 days) and `stress_spending_loop` (evening meetings → sleep disruption → late-night spending)

### orchestrator.py

Two orchestrator phases:

- `orchestrator_plan` — classifies query intent, sets `supervisors_needed`, triggers conditional fan-out
- `orchestrator_synthesize` — reads all domain reports and patterns, executes auto-approvable actions (reversible: runs immediately; irreversible: asks first), generates final response

The full graph is assembled in `build_graph()` using LangGraph's `StateGraph`, `add_edge`, and `add_conditional_edges`.

---

## Quickstart

### Requirements

```
Python 3.11+
langgraph
langchain-core
```

### Install

```bash
git clone https://github.com/youssef-medd/DeepMind
cd DeepMind
pip install langgraph langchain-core
```

### Run

```bash
python3 orchestrator.py
```

No API keys required — all data sources are mocked. You will see all three example queries execute with full agent traces printed to stdout.

### Try a custom query

```python
from orchestrator import run

response = run("How is my sleep lately?")
print(response)

response = run("Why do I always feel broke?")
print(response)
```

---

## Swapping mocks for real APIs

Each worker has a `_fetch_*` function at the top of `workers.py`. Replace these with real API calls:

| Worker           | Mock function          | Real API                        |
| ---------------- | ---------------------- | ------------------------------- |
| Sleep analyst    | `_fetch_sleep_data`    | Apple HealthKit REST / Oura API |
| Activity tracker | `_fetch_activity_data` | Apple Health / Google Fit       |
| Calendar analyst | `_fetch_calendar_data` | Google Calendar MCP             |
| Spending analyst | `_fetch_spending_data` | Plaid Python SDK                |

The agent logic (anomaly detection, scoring, state writing) does not change — only the data fetch function.

---

## Key LangGraph patterns used

**Parallel fan-out with conditional edges**

```python
graph.add_conditional_edges(
    "orchestrator_plan",
    route_to_workers,          # returns a list of node names
    {"sleep_analyst": "sleep_analyst", ...}
)
```

LangGraph calls all returned nodes in parallel automatically.

**Automatic fan-in**

```python
graph.add_edge("sleep_analyst",    "health_supervisor")
graph.add_edge("activity_tracker", "health_supervisor")
```

Any node with multiple incoming edges waits for all of them before running. No explicit barrier needed.

**Parallel-safe state merging**

```python
# In state.py
domain_reports: Annotated[list[DomainReport], operator.add]

# In a supervisor
return {"domain_reports": [report]}   # appends, never overwrites
```

**Action safety boundary**

```python
# Reversible actions run immediately
{"action": "block_calendar_time", "auto_execute": True}

# Irreversible actions wait for user approval
{"action": "decline_meeting", "auto_execute": False}
```

---

## Roadmap

- [ ] Replace mock data with real API integrations (Plaid, Google Calendar, Apple Health)
- [ ] Replace keyword routing with LLM-based intent classification
- [ ] Replace template synthesis with LLM response generation
- [ ] Add `memory_agent` with pgvector for long-term episodic memory and 30-day pattern correlation
- [ ] Add `budget_tracker`, `focus_tracker`, `comms_monitor` workers
- [ ] Add proactive alert pipeline (cron + pattern matching + alert gating)
- [ ] Add voice input via Whisper
- [ ] FastAPI REST wrapper
- [ ] Streamlit dashboard

---

## Why this architecture matters

The cross-domain insight — "your evening meetings cause your sleep to drop, which causes your late-night spending to spike" — cannot come from any single-domain agent. It requires:

1. A worker that measures sleep quality independently
2. A worker that measures calendar load independently
3. A worker that measures spending patterns independently
4. A supervisor that sees all three and computes the correlation

That is precisely what this architecture delivers. The intelligence is not in any single agent — it emerges from the hierarchy.

---

## License

MIT
