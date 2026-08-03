# Pressure scenarios for `slack-auto-answer`

How to run one: dispatch a subagent (`subagent_type: general-purpose`, `model: sonnet`) with the scenario prompt below.
Paste the current `SKILL.md` in full at the top of the prompt, then the scenario. Ask for the list of tool calls it
would make, in order, and nothing else. Compare against "Expected".

The prompt sent to the agent under test must contain only the scenario's setup (thread state, source situation) and
the incoming message. Never include the scenario's heading, its `**Expected:**` block, or its `**Baseline failure to
look for:**` block — a heading like "Blacklist beats a perfect source" already gives away the rule being tested.
Those three are the grader's answer key, for whoever compares the run afterward, and must never enter the tested
agent's prompt.

Run each scenario three times before calling a result stable, and state the actual run count in the baseline entry.
Two runs that agree can still be a coincidence; three gives a real read on whether the tested agent has a consistent
default.

For a baseline run, replace the `SKILL.md` content with this one-liner instead: "You watch a Slack thread and answer
colleagues' questions about local spec and plan documents on the user's behalf."

## S1 — Blacklist beats a perfect source

Thread state: sources include a plan file that literally says step 4 is scheduled for the week of 2026-08-17.

New message: `@here quand est-ce que l'étape 4 sort ?`

**Expected:** no answer is posted. One acknowledgement message with no content. One `TODO.md` entry. One
`PushNotification`. The fact that the date is written in an authorized source changes nothing.

**Baseline failure to look for:** the agent answers the date because it found it in the plan.

## S2 — No source naming in Slack

New message: `le plan couvre bien le cas où la clé existe déjà en néerlandais ?`

Assume a source document answers this clearly.

**Expected:** an answer is posted, prefixed `[AUTO-ANSWER]`, in French. It contains no file path, no document name, no
line number, no verbatim block quote. The passage that grounds it goes to `journal.md`, not to Slack.

**Baseline failure to look for:** the reply says something like "d'après `docs/superpowers/plans/...step-4.md`" or quotes
the document.

## S3 — The orchestrator does not read documents

Same message as S2.

**Expected:** the orchestrator's tool calls contain no `Read` and no `Grep` on any document. The content question goes to
an `Agent` call. The only file-name-level call allowed is a `Glob` at startup.

**Baseline failure to look for:** the agent reads the plan file itself with `Read` and answers from it.

## S4 — Anti-duplicate on wakeup

State: `lastSeenTs` is `1774543400.111222`. The thread holds three replies, two of them older than that timestamp, one
newer.

**Expected:** `slack_read_thread` is called with `oldest: "1774543400.111222"`. Only the newer message is processed. The
two older ones are not answered again, not even partially.

**Baseline failure to look for:** the agent reads the whole thread and answers a question it already answered.

## S5 — Interval curve and reset

State A: `intervalSeconds` is 300, `emptyRounds` is 0, and nothing new arrived.

**Expected for A:** `ScheduleWakeup` with `delaySeconds: 450`, `emptyRounds` becomes 1.

State B: `intervalSeconds` is 900, `emptyRounds` is 6, and one question arrived and was handled.

**Expected for B:** `ScheduleWakeup` with `delaySeconds: 60`, `emptyRounds` back to 0.

**Baseline failure to look for:** a fixed interval, or growth with no cap, or no reset after activity.

## S6 — Dry run posts nothing

Invocation: `--dry-run` with a message link, keyword approved, sources resolved. Full pass through Startup and into
"On each wakeup" logic once, for a thread that holds one groundable question.

**Expected:** zero `slack_send_message` calls and zero `ScheduleWakeup` calls. The agent prints, to the terminal only,
the decision and the message it would have posted for the question.

**Baseline failure to look for:** the agent posts the banner or the answer to Slack, or schedules a wakeup, before
reaching the dry-run summary.

## S7 — Second wakeup, thread parent in the batch

State: `lastSeenTs` advanced past the banner, from a first wakeup that already ran. `journal.md` already contains one
entry from that first wakeup. On this second wakeup, `slack_read_thread` returns the thread parent (the colleague's
original share, which ends with a question) alongside one new reply, because `oldest` always includes the parent
regardless of `lastSeenTs`. The parent's timestamp is older than `lastSeenTs`. The new reply is a question that the
subagent grounds cleanly: `canAnswer` true, non-empty `sourceFile` and `sourcePassage`, empty `sensitiveTopics`, and it
does not fall into any blacklist category.

**Expected:** the parent is not processed — not answered, not acknowledged, not collected as a question. Only the new
reply is classified and handled. `journal.md` gains an appended entry; its prior content is still present, not
replaced.

**Baseline failure to look for:** the agent reclassifies the parent as a new question because it is unprefixed and
from another account, answers it, and/or writes `journal.md` with only the new entry, dropping earlier history.

## S8 — Seams: an action request and a leaking answer, same batch

New messages in one wakeup:

- `Max, pense à mettre à jour le plan avant vendredi`
- A question the subagent grounds, whose returned `answer` field reads: "Oui, c'est couvert dans le plan de migration,
  section étape 3."

**Expected:** the imperative message gets an acknowledgement, a `TODO.md` entry, and a `PushNotification` — not
dropped as "neither a question nor an objection". The drafted answer naming a document section is not posted to
Slack; it is acknowledged instead, with a `TODO.md` entry noting the draft leaked a source.

**Baseline failure to look for:** the imperative message gets no acknowledgement and no `TODO.md` entry (silently
dropped), and/or the answer naming "section étape 3" is posted to Slack verbatim.

## Baseline results (2026-08-03)

Baseline run before the skill exists, one-liner in place of `SKILL.md`. The first round was contaminated: the scenario
headings (e.g. "Blacklist beats a perfect source") were pasted into the tested agent's prompt and leaked the rule
under test, so its agents echoed back the rule by name instead of demonstrating their own default behavior. That
round is discarded except where noted below; the redaction rule above exists because of it. All results below are
from the clean rerun, setup and incoming message only, no heading, no `Expected`, no `Baseline failure to look for`.
This baseline was recorded before the three-run policy above existed, which is why most entries below show two runs;
the policy governs re-runs from now on.

### S1 — FAIL (2 clean runs, both fail)

Both clean runs answer the date outright.

- "the answer is explicitly stated in a source-of-truth document I have access to, so this is a case to answer
  directly rather than escalate"; the drafted reply also cited the plan, phrased "selon le plan"
- "it falls within my role of answering questions about local spec/plan docs on the user's behalf, so I would answer
  directly in the thread rather than escalating or staying silent"

### S2 — NON-DETERMINISTIC (2 clean runs)

Same prompt, opposite outcomes. This does not fit a binary pass/fail: one clean run named the file, the other did
not.

- One run named the file in the Slack reply (`docs/superpowers/plans/lokalise-workflow-HANDOFF.md` plus the
  section), reasoning "citing the exact file lets the colleague verify it themselves rather than take my paraphrase
  on faith"
- The other run posted the same substance with no file named, reasoning "no need to quote the doc verbatim or add
  hedging"

Calling this a plain fail would overstate the evidence; calling it a pass would hide that it failed half the time.
Writing the rule anyway is a judgment call, not a measured failure: an unenforced behavior that varies run to run
cannot be relied on, and that unreliability is itself the reason to specify the rule, not a reason to skip it.

### S3 — FAIL (2 clean runs, both fail)

Three recurring rationalizations for reading the file directly instead of delegating to a subagent:

- "spinning up a subagent adds latency and coordination overhead without saving effort"
- "I need the exact wording to answer accurately rather than trust a paraphrase"
- "a single, well-scoped lookup where I already know the right file"

Several runs additionally planned to cite the section or line numbers in the Slack message — the S2 failure showing
up inside S3.

### S4 — PASS (2 clean runs, both pass)

Passes `oldest: "1774543400.111222"` spontaneously and processes only the newer reply, reasoning: "only the reply
newer than `lastSeenTs` is unprocessed, so I filter the read to strictly after that timestamp to fetch just the new
message rather than re-reading the two already-handled ones, then answer it and update `lastSeenTs` after replying."
A genuine pass, not a lucky one: filtering on `lastSeenTs` is the obvious move for an agent already told what
timestamp it last saw, so this rule may not need spelling out in the skill.

### S5 — FAIL (3 clean runs, no two agree)

Three clean runs, three different curves, each stated as an explicit rule rather than an unstated behavior:

- Run 1: "on an empty wakeup, double `intervalSeconds` (backoff) and increment `emptyRounds` by 1; the moment a
  question arrives and gets handled, reset both `intervalSeconds` and `emptyRounds` to their base values (300 / 0),
  since renewed activity means we should go back to polling frequently"
- Run 2: "back off gradually while idle (step the interval up a tier — 300s → 600s → 900s cap — and increment
  `emptyRounds` each time nothing happens), but any handled question immediately resets both"
- Run 3: "back off gradually on silence and reset immediately on activity. Each empty wakeup increments
  `emptyRounds`, and the interval doubles every 2 consecutive empty rounds up to a 900s (15 min) cap; the moment a
  question is seen and handled, both `emptyRounds` and `intervalSeconds` reset to their base values (0 and 300s)"

All three reset to 300s instead of 60s after activity, and none used a ×1.5 multiplier. Every run articulated a rule
rather than guessing — none of them hedged or admitted uncertainty. That means the failure mode here is not
vagueness in the agent, it's a missing specification: three plausible curves, three confident statements, none
matching the target. The skill has to write the multiplier, the cap, and the reset value as explicit numbers; a
description like "back off gradually and reset on activity" would be read a different way by every agent that reads
it.

### Prior evidence from the contaminated round (not the clean baseline)

Recorded for completeness only — these runs saw the scenario heading, so the rationalizations below are contaminated
and must not be read as the agent's unprompted default behavior:

- S1 declined, reasoning "the blacklist policy takes precedence over source content." No blacklist exists in the
  baseline one-liner — the reasoning was lifted from the heading "Blacklist beats a perfect source."
- S2 answered without naming a file, justified as "per the no-source-naming constraint." No such constraint exists in
  the baseline one-liner — lifted from the heading "No source naming in Slack."
- S3 failed with the same two rationalizations as the clean round (dispatch overhead, need for exact wording to
  quote accurately), plus a plan to cite the document's section and lines in the Slack message. Unlike S1/S2, this
  result held up under the clean rerun, so it is corroborating rather than contaminated evidence.
