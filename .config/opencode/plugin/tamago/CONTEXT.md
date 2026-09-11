# Tamago

A creature that lives in the OpenCode terminal, reacts to what the current
OpenCode session is doing, and grows from everything the user has ever done
with OpenCode on this machine.

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
The label the user gives the Tamago; it has no effect on behavior.

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
The Tamago's momentary condition in one OpenCode window: its Activity, when
it started, and how many tools are running. Forgotten when the window closes.
_Avoid_: using "session" alone for the OpenCode session; say **OpenCode
session** for that one

**Tick**:
The regular heartbeat that lets time pass for the Tamago: recovering from
hurt, falling asleep, advancing an animation.

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

## Relationships

- A **Career** has exactly one **Stage** at any time, and exactly one **XP**
- A **Career** belongs to one machine; every OpenCode window shares it
- Each OpenCode window has its own **Session** and its own **Delta**
- Many **Deltas** merge into one **Career**; the order does not matter
- A **Stage** and an **Activity** together select one **Sprite**
- A **Sprite** has one or more **Frames**; every Frame of a Stage has the same
  size
- An **Evolution** happens when the **XP** of a **Career** crosses a **Stage**
  threshold

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
> **Owner:** "Each has its own **Session** and its own **Delta**. On
> **Flush**, both **Deltas** end up in the one **Career**, and both windows
> show the same **Stage**."
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
