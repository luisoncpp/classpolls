# Lessons Learned

Knowledge that helps future development: effective strategies, counter-intuitive facts, and patterns worth remembering across the codebase.

## When to Add

- When a strategy that seemed right turned out to be wrong or suboptimal.
- When something counter-intuitive was discovered through experimentation.
- When a workaround for external dependency behavior was needed and the reason isn't obvious from code.
- When a pattern proved effective and worth formalizing.

## How to Add

Create a new file in this directory named after the topic (e.g., `quill-bounds-always-relative-to-container.md`, `optimistic-ui-pattern-for-toggle-sync.md`). Then add it to the index below.

The entry should answer: **what is counter-intuitive or effective that I should know before starting similar work?**

Avoid: "bug description + fix". Prefer: "what I learned that applies to future work."

## Index

| File | Topic | Date |
|------|-------|------|
| `local-mongodb-dev-latency.md` | MongoDB + Workers local dev latency and secret config management | 2026-05-24 |
| `mongo-dotted-path-writes-need-validated-ids.md` | Validate identifiers before Mongo dotted-path writes | 2026-05-25 |
