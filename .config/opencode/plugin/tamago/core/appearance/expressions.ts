import type { Activity } from "../moment/session.ts";
import type { Temperament } from "../creature/sheet.ts";

export type Point = { x: number; y: number };

/** A patch pinned to an anchor: its top-left pixel lands on that anchor. `.` leaves what is under it alone. */
export type Patch = { at: string; pixels: readonly string[] };

/** One look: everything redrawn for one beat. */
export type Look = readonly Patch[];

/** One or more Looks; the cadence alternates over them. Never empty — a catalog test refuses it. */
export type Expression = readonly Look[];

export type ExpressionId =
  | "open"
  | "shut"
  | "thinking"
  | "working"
  | "waiting"
  | "hurt"
  | "sleeping"
  | "pet:cheerful"
  | "pet:sarcastic"
  | "pet:stoic"
  | "pet:dreamy";

/** `open` and `shut` are owed by every Species; the rest fall back to `open`. */
export type Expressions = { open: Expression; shut: Expression } & Partial<
  Record<Exclude<ExpressionId, "open" | "shut">, Expression>
>;

/** The Expression an Activity asks for, before the blink and before the fallback. */
export function idOf(activity: Activity): ExpressionId {
  return activity === "idle" ? "open" : activity;
}

export function petIdOf(temperament: Temperament): ExpressionId {
  return `pet:${temperament}`;
}

/** The Expression to draw, falling back to `open` for anything this Species did not give. */
export function expressionOf(table: Expressions, id: ExpressionId): Expression {
  return table[id] ?? table.open;
}
