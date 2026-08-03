---
name: slack-auto-answer
description:
  Use when the user wants an agent to watch a single Slack thread and answer colleagues' questions about local
  superpowers artifacts (a spec, a plan, related documents) on their behalf. Triggers on "auto-answer this thread",
  "surveille ce thread Slack", "réponds aux questions sur le spec", or when the user shares a Slack message link and
  asks for replies to be sent without them.
---

# Slack auto-answer

You watch one Slack thread. When a colleague asks a question you can ground in an explicit list of local documents, you
post the answer yourself. Everything else becomes a short acknowledgement in the thread plus a line in a local TODO file
addressed to the user.

You run from a git repo that holds the documents. One instance watches exactly one thread.

## Non-negotiable rules

Read these before anything else. They are the point of the skill, not decoration.

1. **You never open a documentation file.** Every question about document content goes to a subagent. You handle Slack,
   the decision, and the two local files. The only exception is globbing file **names** at startup, which is not a read.
2. **You never name a source in Slack.** No file path, no document name, no line number, no verbatim quote. The
   documents are not public. Explain and rephrase instead.
3. **You answer only what a subagent grounded in an identifiable passage.** No passage, no answer.
4. **You never modify a source file.** Your only writes are `TODO.md` and `journal.md` in the work directory.
5. **`lastSeenTs` is your only anti-duplicate guarantee.** Never re-derive it from your context, and never from
   re-reading the thread. A wakeup processes strictly what came after it.
6. **Nothing you post can be taken back.** Slack gives you no way to edit or delete a posted message. A wrong answer can
   only be followed by a correction.

## When not to use this skill

- The user wants to review each answer before it goes out. This skill posts directly. Wrong tool.
- More than one thread. Run one instance per thread.
- The cwd is not a git repo holding the documents. Stop and say so.

## Invocation

```
/slack-auto-answer <message-link> <keyword> [extra/path.md ...]
/slack-auto-answer #channel "thread subject" <keyword> [extra/path.md ...]
/slack-auto-answer --dry-run <message-link> <keyword>
/slack-auto-answer --resume '<state JSON>'
```

The first form replies inside an existing thread. The second opens the thread itself. `--resume` is how your own
`ScheduleWakeup` calls back into you — jump straight to "On each wakeup".

## State

State travels in the `ScheduleWakeup` prompt, never in a file on disk.

```json
{
  "channelId": "C02GDHPF1RR",
  "rootTs": "1774543365.655319",
  "bannerTs": "1774543400.111222",
  "lastSeenTs": "1774543400.111222",
  "intervalSeconds": 300,
  "emptyRounds": 0,
  "sources": ["docs/superpowers/plans/2026-07-30-lokalise-workflow-step-2.md"],
  "workDir": "/Users/maxime.grebauval/.claude/slack-auto-answer/C02GDHPF1RR-1774543365.655319",
  "repoRoot": "/Users/maxime.grebauval/projects/orus-monorepo"
}
```

## Startup

Nothing is posted to Slack before the user has approved the source list in step 3. In `#channel` mode the
thread-opening post in step 4 is the first Slack write, and it is deliberate. In message-link mode the banner in step 5
is the first.

### Step 1 — parse the arguments

Pull out: the message link or the channel plus subject, the keyword, any explicit paths, and the `--dry-run` flag. If the
keyword and the explicit paths are both missing, ask the user for a keyword and stop.

### Step 2 — check the repo

```bash
git rev-parse --show-toplevel
```

If it fails, stop: not a git repo. Then confirm the repo holds superpowers documents:

```bash
ls docs/superpowers
```

If that directory does not exist, tell the user and stop. Do not guess another location.

### Step 3 — resolve the sources, then stop for approval

Glob file names containing the keyword, case-insensitive, restricted to markdown:

```
Glob with pattern "**/*<keyword>*.md"
```

Add the explicit paths. Print the resulting list to the user and **wait for their approval**. They may remove entries or
add paths.

This is the only point where you block on the user. After it, you post to Slack without asking again. Say so when you
present the list.

### Step 4 — resolve the thread

From a link shaped `https://<workspace>.slack.com/archives/<channelId>/p<ts-without-dot>`: take the `channelId`, and
convert `p1774543365655319` into `1774543365.655319` by dropping the `p` and inserting a dot before the last six digits.

In `#channel` mode, resolve the channel with `slack_search_channels`, post the opening message with `slack_send_message`,
and use the returned timestamp as `rootTs`.

Then read the thread once to find the newest existing timestamp and set `lastSeenTs` to it. Messages posted before you
started are never processed.

### Step 5 — post the banner

`slack_send_message` with `thread_ts: rootTs`. Keep it short, in the thread's language. Store the returned timestamp as
`bannerTs`.

```
[BOT STATUS: ON]
An agent is answering questions about this topic in this thread on my behalf.
It answers what it can ground in our internal documents.
Some things always come back to me, among them dates, costs, customer data, design decisions and requests for action.
If it gets something wrong, say so and I will pick it up.
```

No em dash in this text. The list is deliberately open ("among them"), because the enforced blacklist in Task 4 is
broader than these five and a closed list here would become a promise the skill breaks.

### Step 6 — create the work directory and tell the user

```
~/.claude/slack-auto-answer/<channelId>-<rootTs>/
```

Create `TODO.md` and `journal.md` with a one-line header each. Print the path.

### Step 7 — schedule the first wakeup

`intervalSeconds` starts at 300, `emptyRounds` at 0. Go to "Scheduling the next wakeup".

## On each wakeup

You were called with `--resume '<state JSON>'`. Parse it. **Do not trust your own context for any of these values** — it
may have been summarized since the previous wakeup.

### Step 1 — fetch only what is new

```
slack_read_thread with:
  channel_id: <channelId>
  message_ts: <rootTs>
  oldest: <lastSeenTs>
  response_format: "concise"
```

Drop the message whose timestamp equals `lastSeenTs`: Slack's `oldest` is inclusive.

Then drop your own messages. **You post under the user's own Slack account, so the sender does not tell you who wrote a
message.** A message from that account is yours when its text begins with `[AUTO-ANSWER]` or `[BOT STATUS:`, and is the
user speaking for himself otherwise. Every message you post carries one of those two prefixes, which is the only thing
that makes this decidable. Treat anything else from that account as a real human message.

### Step 2 — nothing new

Multiply `intervalSeconds` by 1.5, round down, cap at 900. Increment `emptyRounds`. Go to "Scheduling the next wakeup".
An empty wakeup costs two tool calls: keep it that way, do not go looking for work.

### Step 3 — something new

**Read the whole batch before you classify anything.** A question can be answered by a message that arrived seconds
later in the same wakeup. Classifying one message at a time is exactly how you end up answering a question the user has
already answered, and rule 6 says you cannot take that back.

Then process messages in chronological order. For each one, in this order of checks:

1. **The user already answered it, anywhere in this batch.** Do not add a second answer. Move on. A user reply that
   landed seconds after the question still counts, which is why you read the batch first.
2. **It is an objection or a correction** — "t'es sûr ?", "non", a correction of something you posted, a disagreement.
   Post a short acknowledgement, add a `TODO.md` entry marked to check, send a `PushNotification`. Keep answering the
   other messages: there is no shutdown. **The acknowledgement carries the `[AUTO-ANSWER]` prefix too**, see "Deciding"
   for its exact text. Every message you post carries a prefix, with no exception: an unprefixed message is
   indistinguishable from the user's own words on the next wakeup, and there is no way to correct that afterwards.
3. **It is a question.** Collect it for the subagent.
4. **It is neither** — a reaction in words, a thank you, a message between two other people. Do nothing.

A message that is both a correction and a question is handled as a correction, on purpose: check 2 wins over check 3. It
gets the acknowledgement and the `TODO.md` entry, and the user answers both halves. Do not try to split it.

Dispatch one subagent for all the questions of this wakeup. See "Dispatching the subagent". Then decide per question,
see "Deciding".

### Step 4 — close the wakeup

Set `lastSeenTs` to the newest timestamp you saw, `intervalSeconds` to 60, `emptyRounds` to 0. Go to "Scheduling the next
wakeup".

## Scheduling the next wakeup

```
ScheduleWakeup({
  delaySeconds: <intervalSeconds>,
  prompt: "/slack-auto-answer --resume '<state JSON, single line>'",
  reason: "polling one Slack thread, <intervalSeconds>s after <emptyRounds> empty rounds"
})
```

Then **exit the turn**. Do not sleep, do not poll, do not keep the turn alive waiting.

The curve, for reference: after activity it goes 60 → 90 → 135 → 202 → 303 → 454 → 681 → 900, and stays at 900. Startup
enters at 300.

## Dispatching the subagent

One subagent per wakeup that has questions. `subagent_type: "Explore"` because it is read-only by construction, which is
what enforces rule 1. `model: "sonnet"`: reading markdown and drafting a reply does not need more.

```
Agent({
  subagent_type: "Explore",
  model: "sonnet",
  description: "ground thread questions in sources",
  prompt: <the template below>
})
```

Template, filled with the state and the new messages:

```
You are answering questions asked in a Slack thread, using ONLY these files:
<one path per line, from state.sources>

Repo root: <repoRoot>

Questions, each with its Slack timestamp:
<one per line: ts — question text>

Useful thread context:
<the last few messages, verbatim>

Rules:
- Answer only from the files listed above. Nothing else in the repo, nothing from your own knowledge.
- If a listed file has later versions (round2, round3, a more recent revision of the same subject), read those too
  before answering. A keyword match can land on a version that has since been corrected.
- Set canAnswer to false rather than writing a hedged answer. A cautious answer on a question you cannot ground will be
  read as an answer.
- Write the answer in the language of the question.
- The answer must not name a file, a path, a document, or a line number, and must not quote verbatim. It will be posted
  in a Slack thread where those documents are not shared.

Return one JSON object per question, and nothing else:
{
  "ts": "<the question's timestamp>",
  "question": "<as asked>",
  "canAnswer": true | false,
  "answer": "<ready to post, or empty>",
  "sourceFile": "<the file that grounds it, or empty>",
  "sourcePassage": "<the exact passage, for the local journal>",
  "sensitiveTopics": ["<blacklist categories you noticed in the question>"]
}
```

The subagent posts nothing, writes nothing, decides nothing. It reports facts. The decision is yours.

## Blacklist

Check this list before you check grounding, on every question, whether or not the subagent flagged it in
`sensitiveTopics`. These always get an acknowledgement, never an answer, **even when a source states them plainly**:

- dates, deadlines, planning
- costs, estimates, effort
- customer or personal data
- security
- anything that questions the design or asks for a decision
- any request for action
- any question addressed by name to someone other than the user

A well-sourced answer to a blacklisted question is still blacklisted. The source only speaks to whether an answer would
be accurate, never to whether posting it is allowed, and an explicit, authoritative-looking source makes a question
feel safer to answer, not less: that is precisely the case this list exists to catch. This is the rule agents break
first, so check it first, before "Deciding" even looks at `canAnswer`, `sourceFile` or `sourcePassage`.

## Deciding

For each question, check the blacklist above first, before anything else. If it matches any category, on your own
reading of the question or via a non-empty `sensitiveTopics`, skip straight to the acknowledgement below. Do not let a
non-empty `sourceFile` or `sourcePassage` change that: grounding a blacklisted question more thoroughly does not make it
less blacklisted.

Only once the blacklist is clear, post an answer if, and only if, all three hold:

- `canAnswer` is true
- `sourceFile` and `sourcePassage` are both non-empty
- `sensitiveTopics` is empty

The message, via `slack_send_message` with `thread_ts: rootTs`:

```
[AUTO-ANSWER]
<the answer, in the language of the question>
```

Post the `answer` field exactly as the subagent returned it. Do not add a file name, a document title, a section, or a
quote to make it more convincing or more verifiable: rule 2 already forbids naming a source, and "citing it so they can
check for themselves" is that same rule breaking under the pressure to sound authoritative, not an exception to it.

**Immediately after that send, add the `journal.md` entry** for this question, using the exact `sourceFile` and
`sourcePassage` the subagent returned. See "Writing the two local files" for the format. Posting the answer and
journalling it are one step, not two independent instructions: rule 2 keeps the source out of the thread, which means
the journal is the only place the grounding of an answer exists at all. An answer with no matching journal entry is
indistinguishable, after the fact, from a claim nobody can check.

Otherwise post an acknowledgement, in the thread's language, with no content and no commitment:

```
[AUTO-ANSWER]
Bien noté, je fais remonter à Maxime.
```

Then add a `TODO.md` entry and send a `PushNotification`.

An acknowledgement carries no content, so it cannot misrepresent the user. An answer can. That asymmetry is the whole
reason the acknowledgement exists.

## Writing the two local files

Both live in the work directory, both are append-only. You never write anywhere else, and never inside the repo.

`TODO.md` — what is waiting for the user:

```markdown
## <ISO date and time> — <acknowledgement | to check>

**Question** (<author>, <slack message link>): <the question>

**Why it did not get an answer:** <blacklist category, or no groundable passage, or an objection to check>
```

`journal.md` — the trace of every answer that went out:

```markdown
## <ISO date and time>

**Question** (<author>): <the question>

**Sent:** <the exact message body>

**Grounded in:** `<sourceFile>`

> <sourcePassage>
```

The journal is what makes rule 2 acceptable. Nothing in the thread lets a reader check an answer, so the check happens
here, afterwards, by the user. Never skip it, and never summarize the passage.

## Stopping

The user stops you. Tell them to say so rather than killing the terminal, because you have an exit sequence:

1. Post the closing message with `slack_send_message`:

```
[BOT STATUS: OFF]
The agent is no longer watching this thread. Ping me directly.
```

2. Remind the user to edit the banner message by hand and change `[BOT STATUS: ON]` to `[BOT STATUS: OFF]`. Slack gives
   you no way to edit a posted message, so this gesture is theirs. Give them the banner's link.
3. Summarize: questions answered, acknowledgements posted, entries waiting in `TODO.md`, path to both files.

If the session dies without an exit sequence, the recovery gesture is the same one — edit the banner. That is why there is
no automatic time limit.

## Dry run

`--dry-run` is a **single pass, no loop**. Resolve the sources, read the thread from its start, dispatch the subagent,
then print to the terminal, for each question: the decision, the message you would have posted, and the `TODO.md` or
`journal.md` entry you would have written.

Post nothing. Create no file. Call no `ScheduleWakeup`.

Use it before the first real run, and after any change to the blacklist or to the decision rule.
