# Tamago

A creature that lives in the OpenCode terminal, reacts to what the current
OpenCode session is doing, and grows from everything the user has ever done
with OpenCode on this machine.

## Direction

Tamago doit devenir un peu plus un jeu, dans l'esprit du deck-building, avec
les choix du rogue-like mais sans ses runs ni sa mort. La Career est la seule
progression : on y collectionne, on y combine, on y débloque. À certains
jalons, l'Évolution en premier, le Tamago propose un tirage de deux ou trois
options et l'utilisateur en choisit une ; le choix marque durablement la
créature (ses phrases, sa forme, ses traits) et aucune option n'est une
pénalité. Ces règles n'existent pas encore ; les concepts qui en naîtront
rejoignent ce glossaire au fur et à mesure.

## Language

### The creature

**Tamago**:
The creature itself, one per machine, shared by every project and every
OpenCode window.
_Avoid_: pet, buddy, companion, mascot

**Hatch**:
The moment the Tamago comes into existence on a machine.
_Avoid_: create, init, spawn

**Name**:
The label the user gives the Tamago; it has no effect on behavior. It lives
in the Career, so every window shows the same one; when two windows rename at
once, the latest rename wins.

**Temperament**:
How the Tamago speaks and reacts, fixed at hatch and never changed: cheerful,
sarcastic, stoic or dreamy. Derived from the hatch date, so every window
agrees without storing anything.
_Avoid_: personality, mood, attitude

**Craft**:
What the Career says the Tamago does most, weighted: scribe (edits), shell
(bash) or sage (reads). Absent before `young`.
_Avoid_: class, job, role

**Stance**:
How the Tamago works with the user: prudent when it asks many questions per
prompt, bold otherwise. Absent before `young`.
_Avoid_: autonomy level, style

**Vocation**:
A Craft and a Stance together, "prudent shell".

**Character**:
Temperament and Vocation together, "sarcastic · prudent shell".
_Avoid_: personality, traits, profile

**Question**:
The assistant asking the user something through the question tool. Counted
in the Career; it never adds XP.
_Avoid_: prompt (that is the user's), permission (that is OpenCode's)

### In the moment

**Activity**:
What the Tamago is doing right now, in one OpenCode window: idle, thinking,
working, waiting, hurt or sleeping.
_Avoid_: state, status, mode

**Mood**:
The short phrase shown next to the sprite for an Activity ("chilling",
"needs you", "ouch").
_Avoid_: caption, label

**Session**:
The Tamago's momentary condition for one OpenCode session: its Activity, when
it started, and whether that OpenCode session is busy. Forgotten when the
window closes.
_Avoid_: using "session" alone for the OpenCode session; say **OpenCode
session** for that one

**Tick**:
The regular heartbeat that lets time pass for the Tamago: recovering from
hurt, falling asleep, advancing an animation.

### Speech

**Cue**:
Why the Tamago speaks: an event or a pattern of events in one OpenCode
session, never its content.
_Avoid_: trigger, reason

**Bubble**:
The phrase shown above the Sprite for a Cue, for a few seconds, in one
OpenCode session.
_Avoid_: speech, message, quip

**Voice**:
The short memory that decides whether a Cue becomes a Bubble: the current
Bubble, the last Cue spoken, recent failures. One per Session, forgotten
with it.
_Avoid_: cooldown state, history

### Over a lifetime

**Career**:
Everything the Tamago has lived through on this machine: counts of OpenCode
sessions, prompts, tools by kind, files edited, errors, and the hatch date.
_Avoid_: profile, save, progress, stats

**Delta**:
Gains earned in one OpenCode window that have not yet been merged into the
Career.
_Avoid_: pending, buffer, diff

**Flush**:
Merging a Delta into the shared Career so every window sees it.
_Avoid_: save, sync, persist

**XP**:
The single number that summarizes a Career, a weighted sum of its counts.
Errors never count.
_Avoid_: score, points, level

**Stage**:
The Tamago's form, one of egg, hatchling, young, adult, elder, decided by XP
alone.
_Avoid_: level, form, phase, tier

**Evolution**:
The passage from one Stage to the next. Gaining XP without changing Stage is
not an Evolution.
_Avoid_: level up, upgrade, growth

**Tool kind**:
The family an OpenCode tool belongs to for counting: read, edit, bash or
other.
_Avoid_: tool type, category

### Appearance

**Sprite**:
The ASCII drawing of the Tamago for a given Stage and Activity.

**Frame**:
One image of a Sprite; a Sprite has one or more Frames that alternate to
animate.

**Face**:
The eyes and the mark beside the head that change with the Activity while
the body stays the same for a Stage.

**Portrait**:
The Sprite and its text column, topped by the Bubble when there is one.
_Avoid_: card, widget

## Relationships

- A **Career** has exactly one **Stage** at any time, and exactly one **XP**
- A **Career** belongs to one machine; every OpenCode window shares it
- Each root OpenCode session has its own **Session**; each window has one
  **Delta**
- A child (subagent) OpenCode session has no **Session** of its own; its work
  still reaches the **Career**
- Many **Deltas** merge into one **Career**; the order does not matter
- A **Stage** and an **Activity** together select one **Sprite**
- A **Sprite** has one or more **Frames**; every Frame of a Stage has the same
  size
- An **Evolution** happens when the **XP** of a **Career** crosses a **Stage**
  threshold
- A **Session** has exactly one **Voice**; a **Voice** holds at most one
  **Bubble**; a **Bubble** comes from exactly one **Cue**
- The home screen has no **Voice**: without an OpenCode session there is no
  **Cue**
- A **Career** has exactly one **Temperament**, decided by its hatch date
- A **Career** at `young` or above has exactly one **Vocation**; below, none
- A **Character** is read, never written; two windows always show the same
- The **Voice** speaks with the **Temperament**; the **Face** of a pet wears
  it; the card states the whole **Character**

## Example dialogue

> **Dev:** "When a tool fails, does the **Tamago** lose **XP**?"
> **Owner:** "No. It goes **hurt** for a few **Ticks**, that is its
> **Activity**, then it recovers. The **Career** only counts the error."
>
> **Dev:** "So the error still shows up somewhere?"
> **Owner:** "In the **Career**, as a count. It never touches **XP**, so it
> can never change the **Stage**."
>
> **Dev:** "And if I have two OpenCode windows open?"
> **Owner:** "Each has its own **Delta**, and each session on screen its own
> **Session**. On **Flush**, both **Deltas** end up in the one **Career**,
> and both windows show the same **Stage**."
>
> **Dev:** "Is reaching 1,500 XP an **Evolution**?"
> **Owner:** "Only if it crosses into a new **Stage**. Going from 1,400 to
> 1,499 is just gaining **XP**."

## Flagged ambiguities

- "session" meant both the OpenCode conversation and the Tamago's momentary
  condition. Resolved: **Session** is the Tamago's; the other is always
  **OpenCode session**.
- "mood" and "activity" were used interchangeably. Resolved: **Activity** is
  the condition, **Mood** is the phrase displayed for it.
- "evolve" was used for any XP gain. Resolved: **Evolution** is a Stage
  change only.
- "state" was used for Session, Career and Activity. Resolved: the word is
  avoided; each concept has its own term.
