After every change to TypeScript source files in `src/` (fix, feature, refactor, config):

1. **CHANGELOG.md** — append entry under the existing `[Unreleased]` heading only.
   - Format: `- <tag>: <description> (#<PR number>)`
   - Allowed tags: `fix`, `feat`, `enhance`, `docs`, `add`, `change`
   - **Do NOT create a new version heading** (e.g., `[1.4.1]`).
   - **Do NOT change the version in `package.json`.**
   - Version bumps and release tag creation are handled by a separate
     automation — entries must remain under `[Unreleased]` until then.
2. **README.md** — if the change introduces a new setting, behavior, or
   user-facing difference, document it in the relevant section.
