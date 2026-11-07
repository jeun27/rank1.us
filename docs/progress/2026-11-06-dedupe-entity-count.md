# X30 follow-up: drop the duplicate picker-count tests (data-pipeline, branch test/dedupe-entity-count)

README rule 10, reason for deleting tests: #183 and #185 both tested the picker-load entity count, so each path now has one test.

- Removed (from #185, tests/unit/connections/service.test.ts): "loading the picker saves how many entities Google listed" and "a failing count save never breaks the picker (code logged only)".
- Still covered by #183's tests in the same file: "stores how many entities the account offers" and "a failed count save is logged by code and the list still returns" (which also asserts the exact log line).
- Kept: #185's two connect-time tests ("right after a connect, the count is saved once with the fresh token", "a connect still succeeds when listing for the count fails"). No code change.
