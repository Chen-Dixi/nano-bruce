# RELIABILITY

Reliability baseline for agent-driven development.

## Execution policies

- Use bounded retries for transient failures.
- Classify errors before retrying.
- Stop infinite loops by enforcing max attempts.

## Verification policies

- Run type/build checks on touched packages.
- Run targeted tests for changed behavior.
- Add one realistic scenario test for workflow changes when possible.

## Incident notes

For severe regressions, create a brief postmortem under `exec-plans/completed/`.
