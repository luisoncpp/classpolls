# Mongo Dotted-Path Writes Need Validated IDs

Writing user-controlled identifiers into Mongo dotted paths is only safe when the identifier format is validated before building the update key.

For ClassPolls, `studentId` is used in `questions.$[q].votes.${studentId}`. That means vote writes must reject any non-UUID value before the DB layer runs, even if the frontend normally generates the id.

Why this matters:
- `.` changes the path shape
- `$` is special in Mongo field names
- unexpected nesting can overwrite unrelated vote slots or grow documents unpredictably

Preferred rule in this codebase:
- validate externally supplied ids in the handler
- only call the DB deep module with already-validated primitives
