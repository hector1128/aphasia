
# Engineering Guidelines

## Implementation
- Before any UI change, read `docs/ui-components.md`. Reuse its shared components and update the reference when component sizes, colors, spacing, radii, states, or responsive behavior change.
- Prefer the simplest solution that meets requirements.
- Reuse existing project patterns and utilities.
- Avoid unnecessary dependencies and abstractions.
- Preserve existing behavior unless explicitly asked otherwise.
- Keep changes scoped to the requested task.

## Planning
- For complex features, inspect the relevant code first.
- Explain the proposed approach before major architectural changes.
- Identify integration risks and affected components.

## Quality
- Add focused tests for important behavior.
- Run applicable tests, linting, and type checks.
- Do not claim validation without actually running it.
- Report any tests that were skipped or could not run.

## Reviews
- For significant changes, perform a strict maintainability review.
- Prioritize actual bugs and structural problems over cosmetic issues.
- Do not perform unrelated large refactors without approval.
