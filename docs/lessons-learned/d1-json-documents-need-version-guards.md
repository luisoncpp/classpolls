# D1 JSON Documents Need Version Guards

When plans or sessions are stored as JSON blobs inside D1 rows, any read-modify-write flow must include an optimistic `version` check in the `UPDATE` statement.

Without that guard, concurrent requests can silently overwrite each other even if each handler validated the current state correctly.

The safe pattern in this codebase is:

1. read `questions_json` and `version`
2. compute the next JSON payload in memory
3. `UPDATE ... SET questions_json = ?, version = version + 1 WHERE ... AND version = ?`
4. retry once if `changes = 0`
