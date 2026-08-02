# Desktop Packaging PR #377 Final Acceptance Criteria

Status: frozen. This document is the non-transitional final acceptance standard for continuing PR #377. After this file is first added, its criteria must not be changed. The final independent audit subagent must inspect this document exactly as written.

## Original User Requirements Captured In This Standard

- Do not close PR #157.
- Continue PR #377.
- Use multiple agents in parallel where useful, assigning each agent a dedicated goal.
- Split work into independent pieces, run them concurrently, and synthesize the returned results.
- First create a final non-transitional acceptance criteria document and a scoring rubric document.
- Once these two documents are formed, do not change them.
- At the end, before marking the goal complete, launch a fresh subagent that does not inherit the long parent context. That subagent must audit the current code against the original requirements and this final acceptance document, then give a completion score.
- The goal can be marked complete only if the final audit score is greater than 9.5.

## Final Acceptance Criteria

The work is complete only when every criterion below is satisfied.

1. PR #157 remains open and is not closed, merged, retargeted, or otherwise modified by this task.
2. PR #377 remains the active continuation path for desktop packaging work.
3. The PR #377 branch incorporates the latest `main` branch and has no merge conflicts.
4. The desktop implementation builds an Electron desktop application for Banana Slides.
5. The backend is packaged for desktop use with PyInstaller or an equivalent deterministic backend packaging step.
6. The desktop application can start its bundled backend process from the packaged app.
7. The backend port selection and discovery flow is race-resistant: the frontend receives the actual backend port used by the backend, and desktop API requests do not silently fall back to an incorrect fixed port.
8. The desktop backend exposes `/health` successfully after packaged startup.
9. Desktop frontend API calls, image URL resolution, SSE or long-running task calls, and export/download calls target the bundled backend correctly when the frontend is loaded from a desktop file context.
10. The desktop app stores database, upload, and export data in user-writable locations rather than read-only packaged resource directories.
11. Existing desktop user databases from older builds are handled safely: startup must either run compatible migrations or repair required columns without destroying existing projects, templates, settings, pages, tasks, materials, and reference-file data.
12. The auto-update check points to `Anionex/banana-slides`, compares the current build to GitHub Releases safely, and does not show false updates for newer local builds.
13. Electron security review items are addressed: renderer windows use context isolation, Node integration is disabled unless a narrowly justified exception is documented, and external URLs are validated before opening.
14. The Windows packaging path can produce an installer artifact suitable for Windows users, such as an NSIS `.exe` setup file.
15. The macOS packaging path can produce a `.dmg` artifact suitable for macOS users.
16. Release automation exists for tag-based desktop builds and uploads desktop artifacts to a GitHub Release or draft Release.
17. Platform-specific assets and dependencies are handled correctly. In particular, Windows-only binaries must not be bundled into macOS artifacts, and large binary dependencies must be justified or replaced with build-time acquisition.
18. The PR does not introduce unrelated large rewrites, unrelated feature changes, generated logs, local machine artifacts, or broad documentation deletions unrelated to desktop packaging.
19. All Gemini review comments and review threads on PR #377 are individually handled and resolved. Fixed comments are resolved after the fix; incorrect comments are resolved with a clear reason.
20. CI status for PR #377 is green after the final push, including lint, unit tests, docs checks, and smoke checks that are required by the repository.
21. Local verification is run and recorded for backend syntax or compile checks.
22. Local verification is run and recorded for frontend lint.
23. Local verification is run and recorded for backend unit tests.
24. Local verification is run and recorded for frontend unit tests.
25. A real desktop packaging verification is run and recorded for macOS DMG generation on the available macOS machine.
26. A real or CI-backed Windows packaging verification is run and recorded for EXE or NSIS installer generation. If local Windows execution is unavailable, a GitHub Actions Windows packaging run is acceptable.
27. A functional desktop smoke verification is run and recorded: launch or directly start the packaged backend from the produced artifact or app bundle, check `/health`, and verify at least one frontend-to-backend request path relevant to desktop mode.
28. E2E or equivalent real workflow verification covers the desktop-specific changed behavior: backend port propagation, file-context URL handling, image URL handling, and export/download behavior.
29. README documentation is updated with desktop packaging usage, release flow, and important limitations.
30. Chinese documentation under `docs/zh/` is updated for desktop packaging usage, release flow, and important limitations.
31. English documentation under `docs/` is updated in sync with the Chinese documentation.
32. PR #377 title and body are updated before final handoff. The body must include file-change summary, test coverage, packaging verification, review-comment handling, and remaining signing or release caveats.
33. If macOS Developer ID signing or Windows code signing is not configured, the limitation is documented clearly and does not block unsigned functional packaging verification.
34. Services started for validation are left running only when required for user acceptance; otherwise temporary processes are cleaned up.
35. The two frozen standard documents created for this task remain unchanged after their initial creation.
36. The final audit is performed by a fresh subagent that does not inherit the long parent context. The audit must inspect the original user requirements, this final acceptance criteria document, the scoring rubric document, the code, the PR state, and recorded verification results.
37. The final audit score is greater than 9.5 before the goal is marked complete.

## Non-Acceptance Conditions

Any of the following means the task is not complete:

- PR #157 is closed or modified as part of this task.
- PR #377 still has merge conflicts.
- PR #377 has failing required checks.
- Desktop packaging is only documented but not actually verified.
- DMG works but EXE or Windows packaging is unverified.
- Review comments remain unresolved.
- Documentation is missing in README, Chinese docs, or English docs.
- The final audit score is 9.5 or lower.
