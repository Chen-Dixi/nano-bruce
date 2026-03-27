# SECURITY

Security guidance for contributors and agents.

## Basics

- Never commit secrets or tokens.
- Prefer least privilege for tool execution.
- Validate and sanitize tool inputs.

## Supply-chain hygiene

- Pin dependencies via lockfiles.
- Review high-risk dependency updates.

## Logging and privacy

- Avoid storing sensitive user content in logs by default.
- If debug logging is needed, redact identifiers and secrets.
