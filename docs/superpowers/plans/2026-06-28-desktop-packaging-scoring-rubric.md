# Desktop Packaging PR #377 Scoring Rubric

Status: frozen. This document is the immutable scoring rubric for the final independent audit of PR #377 desktop packaging work. After this file is first added, it must not be changed.

## Scoring Rules

- Total score is 10.0.
- There is no partial satisfaction. A requirement is either satisfied or failed.
- If a requirement is only partially satisfied, it is failed and receives 0 for that item.
- A score above 9.0 is forbidden unless every foundational gate is satisfied.
- A score above 9.5 is forbidden unless every foundational gate is satisfied and the numeric score is greater than 9.5.
- The goal may be marked complete only when a fresh final audit subagent gives a score greater than 9.5.

## Foundational Gates

If any foundational gate fails, the maximum score is 8.9 no matter how many numeric items pass.

1. PR #157 is still open and was not modified by this task.
2. PR #377 is the continuation branch being evaluated.
3. PR #377 has no merge conflicts against latest `main`.
4. Required CI checks for PR #377 are green after the final push.
5. All review threads on PR #377 are handled and resolved.
6. The final acceptance criteria document and this scoring rubric document were not changed after initial creation.
7. The final audit was performed by a fresh subagent without inherited long context.
8. The final audit score is produced from the original user requirements, the final acceptance criteria document, this rubric, current code, PR state, and recorded verification evidence.

## Automatic Caps

These caps override the numeric score.

- If PR #157 is closed or modified by this task: maximum score 0.0.
- If PR #377 is not used as the continuation path: maximum score 2.0.
- If no immutable final acceptance and scoring documents exist: maximum score 4.0.
- If the desktop app cannot build at all: maximum score 5.0.
- If neither DMG nor EXE packaging is verified: maximum score 6.0.
- If only one of DMG or EXE packaging is verified: maximum score 8.0.
- If required tests are not run and no valid reason is documented: maximum score 8.5.
- If any required review thread remains unresolved: maximum score 8.9.
- If documentation is missing from README, `docs/zh/`, or `docs/`: maximum score 9.0.
- If the final fresh-subagent audit is not performed: maximum score 9.5.

## Numeric Score Items

Each item is all-or-nothing.

1. PR stewardship and branch hygiene: 1.0 point
   - PR #157 untouched and open.
   - PR #377 branch is current with `main`.
   - No merge conflicts remain.
   - No unrelated generated logs, local artifacts, broad rewrites, or unrelated feature changes are introduced.

2. Desktop application architecture: 1.0 point
   - Electron desktop shell exists and is wired to the frontend.
   - Packaged backend is included and launched by the desktop app.
   - Desktop mode works from file context instead of assuming web dev server semantics.

3. Backend packaging and data safety: 1.0 point
   - Backend packaging is deterministic.
   - Database, upload, and export paths use writable user data locations.
   - Existing desktop databases are migrated or repaired without destroying user data.
   - Packaged backend `/health` succeeds.

4. Port, API, asset, and export behavior: 1.0 point
   - Backend port is discovered without the incorrect fixed-port fallback race.
   - API calls use the actual desktop backend base URL.
   - Image URLs work from desktop file context.
   - SSE or long-running task calls work from desktop file context.
   - Export/download behavior works through the desktop backend and native save flow where applicable.

5. Packaging outputs and release automation: 1.0 point
   - macOS DMG generation is verified.
   - Windows EXE or NSIS installer generation is verified.
   - Tag-based release workflow builds desktop artifacts and uploads them to GitHub Release or draft Release.
   - Platform-specific dependencies are correct and large binary dependencies are justified or replaced.

6. Security and auto-update correctness: 1.0 point
   - Auto-update checks `Anionex/banana-slides`.
   - Update comparison avoids false updates for newer local builds.
   - Electron renderer security settings follow context isolation and disabled Node integration unless narrowly justified.
   - External URL opening is protocol-validated.

7. Automated and real verification: 1.0 point
   - Backend compile or syntax check is run.
   - Frontend lint is run.
   - Backend unit tests are run.
   - Frontend unit tests are run.
   - Desktop-specific E2E or equivalent real workflow verification is run.
   - Real packaging and packaged smoke checks are run and recorded.

8. Documentation and PR communication: 1.0 point
   - README documents desktop packaging usage, release flow, and limitations.
   - Chinese docs under `docs/zh/` document the same.
   - English docs under `docs/` are synchronized.
   - PR title and body summarize file changes, tests, packaging verification, review handling, and signing/release caveats.

9. Review closure: 1.0 point
   - Every Gemini and human review comment is individually evaluated.
   - Fixed comments are resolved after verification.
   - Incorrect comments are resolved with an explanation.
   - A final review request is triggered after fixes.

10. Final independent audit readiness: 1.0 point
    - Evidence is organized so a fresh subagent can audit without relying on parent context.
    - The fresh subagent audits the original requirements, frozen documents, code, PR state, and verification results.
    - The fresh subagent score is greater than 9.5.

## Completion Threshold

The task is complete only if:

- All foundational gates pass.
- No automatic cap blocks completion.
- The total numeric score is greater than 9.5.
- The final fresh-subagent audit score is greater than 9.5.
