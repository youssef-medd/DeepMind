# Changelog

All notable changes to MindPilot will be documented here.

## [Unreleased]
- Add `userId` field to state for user-scoped memory and personalization
- Add `sessionId` field to state — generated at plan time via `crypto.randomUUID()` if not provided; enables per-run tracing and future session-scoped memory

## [0.1.0] - 2026-09-21
- Phase 1 core graph complete (state, workers, supervisors, orchestrator, LangGraph wiring)
- Add `timestamp` field to state — set at plan time, available for future logging and memory
- Add `GENERAL_KEYWORDS` for explicit full-scan routing; expand domain keyword lists
