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

Drop your own messages from the result, and drop the message whose timestamp equals `lastSeenTs`.

### Step 2 — nothing new

Multiply `intervalSeconds` by 1.5, round down, cap at 900. Increment `emptyRounds`. Go to "Scheduling the next wakeup".
An empty wakeup costs two tool calls: keep it that way, do not go looking for work.

### Step 3 — something new

Process messages in chronological order. For each one, in this order of checks:

1. **The user already answered it themselves.** Do not add a second answer. Move on.
2. **It is an objection or a correction** — "t'es sûr ?", "non", a correction of something you posted, a disagreement.
   Post a short acknowledgement, add a `TODO.md` entry marked to check, send a `PushNotification`. Keep answering the
   other messages: there is no shutdown.
3. **It is a question.** Collect it for the subagent.
4. **It is neither** — a reaction in words, a thank you, a message between two other people. Do nothing.

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
