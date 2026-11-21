# Resumable editable export pipeline

Status: implemented after 2 architecture review rounds and a final implementation
review (3 reviews total).
Applies to both editable modes.

## Requirements

Preserve strict fail-fast and explicit partial export. A failed dependency must
surface without waiting for a blocked sibling; queued work and retries stop.
No late progress or artifact can resurrect a terminal task. Every wait is
bounded. A failed/interrupted export can explicitly resume committed checkpoints
without repeating committed, verified nodes. Progress identifies actual work.
Retain the existing providers, text fitting, clustering, font embedding and PPTX
builder; incorporate Restore's target/erase/review/feedback retry contract.

## Execution boundary

The Flask task manager runs a small supervisor, not image/model work. It launches
one disposable Python worker process per export. The worker receives a settings
snapshot through stdin (no credentials in files/argv), sends structured progress
through stdout, and logs to stderr. Only the supervisor writes task state and
publishes the final PPTX. The child writes only staging files/checkpoints.

The supervisor enforces a queue deadline and a whole-run deadline, observes
worker exit and database terminal state, and kills/reaps the worker on abort.
A parent-liveness pipe prevents a child from surviving backend death. Within the
worker an ExportControl propagates first failure and per-operation deadlines;
completion collection never waits for a subset of futures before examining
others. No nested child-element pools: recursive analysis is serial within each
page. Page workers and text-style workers are bounded.

Native OS file locks in the shared upload runtime directory provide cross-worker
and cross-process capacity slots (exports, page analysis, caption, image, OCR,
local inference). Locks release on process death, so no stale lease timeout can
grant capacity while the old process is still running. All export retries use
the same slots. Resource acquisition is cancellable and deadline bounded.
This targets one deployment with shared local storage, like the existing SQLite
app; it does not claim a distributed scheduler across independent hosts.

Provider retries have one transport owner: no SDK retry multiplication during
exports. Transient failures use bounded exponential backoff with jitter;
authentication, payment and exhausted daily quota fail immediately. Semantic
retries (missing style fields, rejected erasure) are separate bounded attempts
inside the same operation deadline. No provider/model fallback is introduced.

## Checkpoints

Each attempt has an immutable run ID and private workspace. Versioned JSON
checkpoints are written by atomic rename only after validation. No pickle.
Stages: extraction; accepted background; recursive analyzed page; global style;
individual text style; final assembly. Keys include source content hash,
algorithm/prompt version, provider/model/endpoint identity, relevant options and
stage input. Artifact references carry content hashes and are checked on read.
Missing/corrupt artifacts invalidate that node and dependent nodes.

A resume request names a failed source task in the same project and creates a
new task ID. It uses the original page selection/options, checks current source
and model settings, and reuses only matching completed nodes. Changes invalidate
affected nodes rather than silently exporting stale content. Credentials are
resolved afresh so correcting a key does not discard valid work. Source images
are snapshotted per run to avoid edits changing an in-flight export.

Duplicate HTTP submissions are idempotent using client_task_id. Simultaneous
resume requests for one failed attempt resolve to one successor. Successful,
pending and running tasks cannot be resumed. Each worker writes its own run;
late results cannot mutate another attempt's checkpoints or publish a deck.
Checkpoint metadata remains available after backend restart; killed work is
marked failed and the UI offers an explicit Resume action, not an automatic
billable restart. A new browser can retrieve resumable task records from API.

## Restoration and partial mode

Simple mode uses explicit text targets + optional native mask, then checks OCR
residuals and visual QA (target removal, unchanged non-targets, artifacts).
Ambiguous isolated OCR glyphs are reviewed in enlarged context crops before
building the target plan, so a profile icon read as "8" stays artwork. Comparative
QA uses labeled BEFORE/AFTER panels. When OCR is clean and comparative QA accepts
artwork preservation/artifact checks but reports text, an AFTER-only text check
resolves reference-side confusion. It cannot override OCR residue, changed
artwork or comparative artifact rejection. Existing solid title backplates are
judged against the original, not mistaken for smears in an isolated candidate.
Quality exhaustion has its own structured error, stage and checkpoint guidance.

Rejected results retry from the original image with the complete target inventory
and diagnostic feedback, never from the previous generated image or only the
residual subset. Exhausting quality retries invalidates rejected candidates and
reviews, so an explicit resume can generate a fresh candidate. A transport/QA
exception retains the candidate for reuse. Store target plan, attempt images, review verdicts
and accepted background. Keep filled shapes; represent circled-number glyphs
and bullet markers separately and reconcile editable content against retained
marks. This coordination is new Banana work, not claimed as existing Restore.

Full mode uses the same control/checkpoint/deadline boundary for extraction,
backgrounds, recursive children and styles, preserving existing algorithms.
Strict mode propagates all required dependency failures. Explicit partial mode
may keep a failed page as its source image with a visible warning; it never
overlays editable text on an unerased source. Degraded nodes are not committed
as successful checkpoints. Cancellation/deadline always aborts even in partial
mode.

## Publication and progress

The worker emits stage start/completion, page/element counts, retry and waiting
events. Liveness is separate from completed progress. The supervisor updates
progress monotonically and guards every update by active task state. Final ZIP
and slide count are validated; publication is an atomic rename under a task
state transaction, then COMPLETED with a download URL. On failed commit remove
the unpublished final file. Failed tasks never expose an artifact URL.

## Acceptance gates

1. Block a sibling indefinitely; a strict dependency failure reaches FAILED
   promptly, stops queued/retry calls, kills/reaps worker, publishes nothing.
2. Timeout, backend death and external terminal-state change have the same
   fencing/cleanup behavior. Retry survives restart using committed checkpoints.
3. Crash during checkpoint write, corrupt a referenced artifact, modify one
   source/model/option: only compatible verified nodes may be reused.
4. Duplicate creation and simultaneous resume do not run duplicate paid work;
   cross-project/invalid resume requests are rejected.
5. Run >= 24 pages and multiple simultaneous exports; observed requests never
   exceed deployment limits, no nested pool growth or unbounded queue wait.
6. Reject an erasure: every attempt uses the original; failure never commits a
   background. Verify strict and partial modes and marker reconciliation.
7. Preserve source/slide aspect ratios, text fitting and ordinary export paths.
8. Browser: fail -> Resume -> visible reused progress -> actual PPTX download;
   inspect the downloaded PPTX and rendered slides using real configured models.

Review resolutions and validation evidence follow. Injected faults and real
provider runs are reported separately.

## Round 1 resolution / concrete execution contract

- Admission: a cross-process admission mutex plus an `ExportRun` row and Task
  row commit the request together. The queue is capped at 16 active exports;
  each gets a dedicated lightweight supervisor immediately, outside the shared
  generation executor. Queue deadline is persisted from submission, default
  900s. A lightweight child acquires its own owner lock and execution slot before
  importing image/model libraries. Default active export processes: 1, pages: 4,
  caption: 8, image: 4, OCR: 2, inference: 1. Operators can raise these deployment
  limits; separate processes must share the same runtime directory/config.
- The default one active export avoids duplicate resident RMBG models. Model
  initialization and inference both take the local inference slot. Measure RSS
  and process cleanup with 24 pages; raising process count requires accounting
  for a model instance in each active process.
- Worker owns all actual execution/resource locks. Supervisor owns only task
  DB updates and publication. Worker owns immutable stage files. The parent pipe
  remains open for worker lifetime; EOF or loss of parent pulses terminates the
  child process tree. Queue and run deadlines are checked by the supervisor and
  worker. Default run 3600s, node 600s, transport attempts 3, erasure QA attempts
  2. The shortest enclosing deadline wins, including lock/backoff time.
- `PENDING -> RUNNING -> COMPLETED|FAILED`; FAILED/COMPLETED never change.
  Resume creates a new PENDING task, with a unique parent-task constraint in
  ExportRun. Same `client_task_id` and changed parameters returns 409. A repeat
  resume returns the existing successor, including its current terminal state.
- Owner lock is cross-process authority; the existing in-memory watchdog must
  defer new exports to it. Reconcile on startup, status/list reads and before
  resume. An absent owner after a 5s launch grace means interrupted, not running
  elsewhere. Do not start a successor until the previous owner lock is free.
- Each selected page must exist and have a readable image. Missing/deleted pages
  fail preparation explicitly, never silently reduce slide count.
- New filenames use a reserved task-ID prefix. File download/listing checks the
  corresponding COMPLETED task and artifact metadata; old exports stay usable.
  A crash after rename but before DB commit leaves a fenced, inaccessible file.
  Later reconciliation removes that unpublished file. Stage outputs are outside
  static exports. Terminal transitions use conditional SQL updates, not cached
  ORM status checks. A publication loser removes only its own unique output.
- Stage identity is source hash + stage/version + relevant config + normalized
  semantic input. Run directories and random IDs are excluded. Element IDs are
  derived deterministically from page/source, region, type, content and ordinal.
  Store upstream result hashes in dependent identities. Files and directory
  entries are flushed before checkpoint commit. A missing/corrupt checkpoint is
  a cache miss, not success. Retired ancestors are read-only reuse sources.
- Example: change page 12 -> only its extraction/background/page/styles rerun;
  caption model -> global/local styles and visual QA rerun, OCR retained;
  corrupt an accepted background -> erase/review/page composition rerun, valid
  OCR/styles retained. Final assembly always revalidates ordered dependencies.
- A synchronously successful upstream call followed by a crash before commit
  can be repeated. Local storage cannot promise exactly-once remote billing.
  Existing async provider job IDs must be checkpointed before polling and
  resumed; never silently dispatch a second remote job for a known ID.
- Stage result contracts distinguish success, degradation and abort. Required
  extractor/inpaint/recursive failures cannot be swallowed. Partial degradation
  retains an entire failed page as source with warning and no text overlay;
  degraded results never enter successful checkpoints. Abort/deadline is fatal
  in either mode. Existing rendering/style warnings remain explicit.
- Protocol v1 uses JSON lines on a dedicated stdout handle; library stdout is
  redirected to stderr, which the supervisor drains to a run log. Unexpected
  protocol messages/exit are explicit failures. POSIX uses a private process
  group; Windows uses tree termination. Frozen desktop gets a dispatch flag in
  its existing executable entrypoint before server startup (no `python -m`
  assumption for bundled binaries).
- Visual QA accepts only actual JSON booleans, all required checks true.
  Marker reconciliation has retained/removed/uncertain states; uncertainty
  triggers review failure/retry, never deletes editable content speculatively.
  Test circles, plain digits, bullets, OCR false positives and unavailable QA.

Additional gates: saturate the generation pool while submitting export; kill
the supervisor and inspect lock ownership before/after child exit; poll through
another web process; interrupt publication between rename/commit; issue two
simultaneous resumes; run from source and verify frozen entry dispatch; record
peak memory and verify no surviving worker descendants after every failure.

## Round 2 resolution / final

The supervisor independently tracks `node_started(id, absolute_deadline)` and
`node_finished(id)` messages. Start is emitted before any resource wait or
blocking call. The earliest active deadline kills/reaps the worker even when
other nodes keep emitting heartbeats. Retries never refresh that deadline.

Erasure has separate committed candidate and review nodes. A candidate is not an
accepted background. QA API failure resumes QA against the saved candidate;
changing caption configuration reruns QA, changing image configuration reruns
generation. Only explicit QA rejection creates the next original-image attempt
with feedback. Acceptance requires current review success.

The concurrent 24-page fault test explicitly sets active exports to 2 and
verifies shared provider limits, memory measurements, ownership and cleanup.
Production default remains 1. Both startup reconciliation and request watchdog
must use the new cross-process owner-lock contract for pipeline tasks.

References: Python concurrent.futures documents that cancellation cannot stop
running threads (https://docs.python.org/3/library/concurrent.futures.html).
Filelock native backends provide process-scoped locks
(https://py-filelock.readthedocs.io/en/latest/). Restore source was inspected at
`src/erasers/erasure/layout_guard.py`, `vlm_guard.py` and workspace contracts;
DeepWiki has no index for that repository. This is a focused port of its contracts,
not a claim of parity with its entire multi-round slide decomposition pipeline.

## Implementation review / final resolutions

- A separate sentinel process watches parent EOF and missed pulses; a C extension
  holding the worker GIL cannot prevent cleanup. POSIX process groups and Windows
  kill-on-close jobs cover worker descendants. Packaged worker/sentinel dispatch
  exits before importing the server, and Windows pipes explicitly use UTF-8.
  Windows never uses `os.kill(pid, 0)` for liveness: it sends a console signal.
  Closing its job kills/reaps the owned tree without a redundant PID-based kill.
- A supervisor ownership lock spans worker launch through publication. Watchdog
  reconciliation checks it as well as the worker lock, including the interval
  after worker exit and before the final database commit.
- Provider gates cover RMBG initialization and inference, nested hybrid work,
  OCR, and each model request. Required hybrid enhancement/extraction failures
  propagate instead of becoming silent success. SDK/legacy decorator retries
  are bypassed only inside this runtime.
- Image and MinerU asynchronous submissions commit remote job IDs and upload
  completion before polling. Resume polls an existing job; a terminal upstream
  failure invalidates it so a later explicit resume can submit a replacement.
- Fingerprints separate image generation from caption QA/styles and include the
  resolved role-specific endpoint. Workers receive refreshed OAuth credentials
  through stdin and do not access application Settings/database state.
- Ordinary metadata strings are not artifact paths. Artifacts must be within
  the attempt/ancestor workspaces and match their stored hashes. Failed,
  degraded, corrupt and aborted nodes are never reusable successes.
- Publication validates the ZIP, page count and hash, flushes the output, uses
  a terminal-state SQL fence, and removes the renamed file if commit fails.
  Windows flushes owned artifacts through `r+b` handles because read-only handles
  fail with `EBADF`; their contents are preserved.
  Download routes verify the completed task and artifact hash. Project deletion
  removes the durable attempt rows with its tasks.
- The browser reloads server-side task history, preserves explicit dismissals,
  and starts one successor when Resume is clicked. Late status responses cannot
  turn a terminal task back into an active task.

## Verification

- Real configured providers, text-only mode: exported six selected pages,
  terminated the backend after committed analysis/style work, restarted it,
  and resumed through the browser. The successor reused 45 steps and submitted
  no additional image generations. The actual browser download matched the
  published hash: six 16:9 slides, 118 editable text boxes, embedded fonts and no
  export warnings. All six slides were rendered and inspected. Existing font
  matching/visual fidelity limitations remain separate from runtime reliability.
- Real full mode with the existing hybrid settings: MinerU rejected the configured
  token with HTTP 401. The task promptly became a resumable authentication failure
  without an artifact. On 2026-11-07, a replacement token passed authentication
  and the browser resumed that failed task. MinerU submission, upload and extraction
  checkpoints committed. Baidu image repair then rejected the request with error
  17 (daily request limit reached); the worker exited without publishing an artifact.
  Quota exhaustion now has a non-retryable, actionable error instead of being
  classified as an internal failure. The associated 43-test regression suite passed,
  including a single-attempt quota failure and the distinct transient QPS case.
  Successful full-mode export remains blocked by the image-repair quota. Text-only
  mode uses Baidu OCR and generative editing, without Baidu image repair or MinerU.
- Real disposable workers and local HTTP provider fixtures: two simultaneous
  24-page exports in each editable mode, shared image/caption/OCR limits, ordered
  slides, checkpoint recovery and no surviving worker processes. These tests use
  the production pipeline/PPTX builder but fixture model outputs. Observed worker
  peak RSS was approximately 318–320 MiB in text-only mode and 229–230 MiB in full
  mode; these are not memory estimates for real RMBG inference.
- Fault coverage: blocked siblings, a hung node while other nodes send progress,
  parent death during a GIL-blocking call, unexpected worker exit, queue saturation,
  corrupt checkpoints/artifacts, source/model changes, duplicate submissions and
  concurrent resumes, terminal remote jobs, publication commit failure, deleted
  projects, and strict/partial erasure failures without doubled text.
- `scripts/verify_export_process_oom.py` ran inside an isolated 128 MiB Linux
  cgroup: the kernel recorded one OOM kill, the capacity locks were released, and
  a subsequent worker completed. The script refuses to allocate until a bounded
  cgroup is detected. This does not promise that arbitrary export sizes cannot
  exhaust memory; the contract is bounded execution, visible failure and recovery.
- Frontend task-store/panel tests and production build passed. Existing unrelated
  whole-repository TypeScript errors remain. Full PR CI passed 967 backend tests
  (5 skipped), 242 frontend tests, 78 desktop tests and the live-update/web smoke
  integration checks on the first implementation commit. The same unit/build
  suites passed again on `5eebe76b`, including both Windows fixes.
- Windows 11 ARM VM with x64 Python: `scripts/verify_export_windows.py` passed
  success, required failure, node deadline, abrupt supervisor death, subsequent
  worker execution and checkpoint reuse/corruption cases. It verifies both worker
  and descendant termination and native lock release. This found and fixed the
  console-signal and writable-flush-handle issues above. Native packaged dispatch
  also passed against the freshly built Windows executable on commit `5eebe76b`
  in CI run `41879320689`, including pipeline/dependency imports and Unicode
  worker communication. This check runs immediately after backend packaging;
  it does not claim a complete Windows PPTX export with real providers.
- The initial desktop build packaged the Windows backend successfully, then
  failed because the existing pinned FFmpeg download URL returned HTTP 404.
  The export runtime check runs before that unrelated installer dependency.

## Operating limits

Deployment concurrency/timeouts are `EXPORT_LIMIT_EXPORTS`,
`EXPORT_LIMIT_PAGES`, `EXPORT_LIMIT_CAPTION`, `EXPORT_LIMIT_IMAGE`,
`EXPORT_LIMIT_OCR`, `EXPORT_LIMIT_INFERENCE`, `EXPORT_QUEUE_LIMIT`,
`EXPORT_QUEUE_TIMEOUT`, `EXPORT_RUN_TIMEOUT` and `EXPORT_NODE_TIMEOUT`. All web
processes must share the upload runtime directory and these limits. Increasing
active exports loads a separate model instance in each process.

Stopping a local worker cannot cancel computation already accepted by a remote
provider. Known asynchronous job IDs are reused, but a crash after remote success
and before local checkpoint commit can repeat work. Completed checkpoints persist
with the project for explicit recovery; project deletion removes its workspace.
