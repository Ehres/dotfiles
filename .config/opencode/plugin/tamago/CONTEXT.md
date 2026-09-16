# Tamago

A creature that lives in the OpenCode terminal, reacts to what the current
OpenCode session is doing, and grows from everything the user has ever done
with OpenCode on this machine.

## Direction

Tamago doit devenir un peu plus un jeu, avec les choix du rogue-like mais sans
ses runs ni sa mort. La Career est la seule progression. À certains Milestones,
l'Évolution en premier, le Tamago propose un Draw de deux ou trois Traits et
l'utilisateur en garde un ; le Pick marque durablement la créature sur l'une
de ses trois surfaces (ce qu'elle dit, ce à quoi elle réagit, son apparence)
et aucun Trait n'est une pénalité. Les synergies vivent dans l'éligibilité des
Traits, pas dans une collection : sans run, une carte n'aurait nulle part où
être jouée. Chaque Tamago est d'une Species tirée à l'éclosion, plus ou moins
rare, plus ou moins lente à grandir ; la collection viendra comme plusieurs
Tamago sur une machine, un seul en cours à la fois. Les règles arrivent une à
une ; les concepts qui en naissent rejoignent ce glossaire au fur et à mesure.

## Language

### The creature

**Tamago**:
The creature itself: one active per machine, shared by every project and
every OpenCode window; the others rest in the Roster.
_Avoid_: pet, buddy, companion, mascot

**Hatch**:
The moment a Tamago comes into existence on a machine. A new Hatch needs
every Tamago of the machine to be `elder`.
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

**Species**:
What a Tamago is, decided at hatch and never changed: which creature is drawn
at every Stage, and its Rarity. Drawn from the hatch date, then stored in the
Career so that adding a Species later never changes an existing Tamago.
_Avoid_: skin, style, breed, form, type

**Rarity**:
How unlikely a Species is to hatch: common, uncommon, rare, epic or legendary.
A Rarity also sets the Pace of its Species; every Species has exactly one.
_Avoid_: tier, grade, level

**Reference Species**:
The Species of every Career that recorded none: the cat drawn before Species
existed. Common, Pace 1.

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

**Window**:
Everything one OpenCode window holds in memory about the Tamago: the Career
as shown there, its Delta, one Session and one Voice per OpenCode session on
screen, and whether the Voice is muted. Moved by pure functions; forgotten
when the window closes.
_Avoid_: state, store, world, instance

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
sessions, prompts, tools by kind, files edited, errors, the hatch date and the
Species.
_Avoid_: profile, save, progress, stats

**Delta**:
Gains earned in one OpenCode window that have not yet been merged into the
Career. A Delta belongs to the Career it was earned under; a Flush credits
that Career, active or resting.
_Avoid_: pending, buffer, diff

**Flush**:
Merging a Delta into the shared Career so every window sees it.
_Avoid_: save, sync, persist

**XP**:
The single number that summarizes a Career, a weighted sum of its counts.
Errors never count.
_Avoid_: score, points, level

**Pace**:
How fast a Species turns XP into Growth: 1 for common, less for every rarer
Rarity. Set by the Rarity, never by the Species alone.
_Avoid_: speed, multiplier, handicap

**Growth**:
The XP of a Career times the Pace of its Species; the number the Stage
thresholds are compared to. Computed, never stored.
_Avoid_: effective XP, scaled XP, level

**Stage**:
The Tamago's form, one of egg, hatchling, young, adult, elder, decided by
Growth alone.
_Avoid_: level, form, phase, tier

**Evolution**:
The passage from one Stage to the next. Gaining XP without changing Stage is
not an Evolution.
_Avoid_: level up, upgrade, growth

**Tool kind**:
The family an OpenCode tool belongs to for counting: read, edit, bash or
other.
_Avoid_: tool type, category

### The roster

**Roster**:
Every Career of a machine, the active one and the resting ones. None ever
leaves it.
_Avoid_: collection, list, save slots

**Active**:
The Career a machine shows and grows right now. Exactly one per machine: the
one `career.json` holds.
_Avoid_: current, selected, main

**Resting**:
A Career of the Roster that is not the active one. Whole, never changed,
except by a Delta earned under it before a Switch.
_Avoid_: archived, inactive, retired, frozen

**Growing**:
A Tamago whose Stage is below `elder`. At most one per machine: that is what
keeps a Hatch rare.
_Avoid_: in progress, unfinished, young (that is a Stage)

**Switch**:
Bringing a resting Career to the front; the active one goes to rest. Nothing
is earned or lost.
_Avoid_: load, select, swap

### Choices

**Milestone**:
A point of a Career worth a durable mark: an Evolution, a round count of
sessions or tools. Decided by counters alone, computed and never stored.
_Avoid_: achievement, badge, unlock, level

**Draw**:
The two or three Traits the Tamago offers at a Milestone. Deterministic from
the Career, so every window offers the same Draw.
_Avoid_: roll, loot, reward, options

**Pick**:
The Trait the user kept at a Milestone, and when. At most one per Milestone;
across windows the earliest wins. Lives in the Career.
_Avoid_: choice, selection, decision

**Trait**:
A durable mark on the Tamago granted by a Pick: a family of phrases for the
Voice, a Cue it reacts to, a mark or a form on the Sprite. Computed from the
Picks, never stored. A Trait is what the user chose; a Temperament is what the
hatch date decided. A Trait adds to the Temperament, it never replaces it.
_Avoid_: perk, upgrade, buff, card

### Appearance

**Sprite**:
The ASCII drawing of the Tamago for a given Stage and Activity.

**Frame**:
One image of a Sprite; a Sprite has one or more Frames that alternate to
animate.

**Face**:
The eyes and the mark beside the head that change with the Activity while
the body stays the same for a Species and a Stage.

**Portrait**:
The Sprite and its text column, topped by the Bubble when there is one.
_Avoid_: card, widget

## Relationships

- A **Career** has exactly one **Stage** at any time, exactly one **XP** and
  exactly one **Growth**, its XP times the **Pace** of its **Species**
- A **Career** has exactly one **Species**, drawn at hatch, stored, kept on
  merge like the hatch date
- A **Species** has exactly one **Rarity**; a **Rarity** has one draw weight
  and one **Pace**
- A machine has exactly one **Roster**; a **Roster** has exactly one
  **active** Career and zero or more **resting** ones; every OpenCode window
  shares them
- A **Roster** has at most one **growing** Tamago; a **Hatch** is possible
  only when it has none
- A **Delta** belongs to the **Career** it was earned under; the **Flush**
  credits that Career, active or resting
- A **Switch** changes no **Career**; it changes which one is active
- A **Career** is identified by its hatch date: two Careers of one machine
  never hatch in the same millisecond, since a Hatch needs the whole Roster
  to be `elder`
- The sidebar, the home and the card show the **active** Career; the
  **Voices** are its
- An older build knows only the **active** Career: its Deltas credit it,
  whichever it is at Flush time
- Each OpenCode window has exactly one **Window**, which holds one **Delta**
  and one **Session** per root OpenCode session on screen
- A child (subagent) OpenCode session has no **Session** of its own; its work
  still reaches the **Career**
- Many **Deltas** merge into one **Career**; the order does not matter
- A **Species**, a **Stage** and an **Activity** together select one
  **Sprite**; at `egg` the Species selects nothing, every egg is the same
- The **Species** shows at the Evolution to `hatchling`, on the card, in a
  Bubble and in the toast; before that the card says it is still an egg
- A **Sprite** has one or more **Frames**; every Frame of every Species and
  Stage has the same size
- An **Evolution** happens when the **Growth** of a **Career** crosses a
  **Stage** threshold
- A **Session** has exactly one **Voice**; a **Voice** holds at most one
  **Bubble**; a **Bubble** comes from exactly one **Cue**
- The home screen has no **Voice**: without an OpenCode session there is no
  **Cue**
- A **Career** has exactly one **Temperament**, decided by its hatch date
- A **Career** at `young` or above has exactly one **Vocation**; below, none
- A **Character** is read, never written; two windows always show the same
- The **Voice** speaks with the **Temperament**; the **Face** of a pet wears
  it; the card states the whole **Character**
- A **Career** holds zero or one **Pick** per **Milestone**
- A **Milestone** is reached when the counters of the **Career** satisfy its
  rule; reaching it is a fact about the counters, not an event
- A **Milestone** that is reached, has no **Pick** and whose **Draw** is not
  empty is **pending**; the first pending one is the one offered
- A **Trait** is **held** when a **Pick** names it, and **eligible** when it is
  not held and every Trait it needs is held
- A **Draw** contains only eligible **Traits**; once held, a Trait is never
  drawn again
- A **Pick** is a **Delta** like a rename: made in one window, flushed with the
  counters, merged into the shared **Career**

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
