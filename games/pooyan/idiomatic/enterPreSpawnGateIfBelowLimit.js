// SPDX-License-Identifier: GPL-3.0-only
import { spawnObjectGatedByArmedActorCount } from "./spawnObjectGatedByArmedActorCount.js";

/**
 * enterPreSpawnGateIfBelowLimit — the pre-spawn guard on an actor's approach.
 *
 * WHAT IT IS
 *   A tiny two-part decision that stands in front of the enemy-spawn machinery. An enemy actor
 *   crawling toward its target column feeds this guard a single byte in register B — the actor's
 *   screen X coordinate as advanced this frame — and the guard decides one of two things: give up
 *   for now, or hand the actor on to the pre-spawn gate that may release the next wave object. It
 *   holds no state of its own; it is purely a threshold on that X byte.
 *
 * ROLE IN THE MACHINE
 *   Pooyan releases each enemy wave a piece at a time as the seeking actors travel across the
 *   playfield. This guard is the position trip-wire in that release: the follow-on spawn is only
 *   allowed to be *considered* once a seeking actor has carried its X coordinate down below 0x20 —
 *   into the low-X band near the left edge of the screen, the point on the actor's path where the
 *   next object is due to enter. Until then B still sits at or above 0x20 and the guard simply
 *   bails, leaving the world untouched this pass. The target-tile resolvers
 *   (advanceActorTowardTargetColumn / resolveTargetColumnAndArmApproach) reach this guard by a
 *   tail-jump the instant an actor lands exactly on its target column, so the guard and its two
 *   outcomes all run inside that resolver's frame — a bail here returns straight back to whatever
 *   invoked the resolver.
 *
 * ROM 0x3617-0x361c.
 *   3617 ld a,b     — A <- B (the advanced X byte); A is the only register this guard writes
 *   3618 cp 0x20    — compare A against the 0x20 limit (sets carry when B < 0x20)
 *   361a ret nc     — B >= 0x20: return here, A left holding B
 *   361b jr 0x365d  — B <  0x20: tail into the pre-spawn gate
 *
 * Grounding: [seen].
 *
 * LIVE-OUT: none of its own — a dispatched state handler; the caller reloads A and reads no register
 *   back. On the bail path A is left holding B (the `ld a,b` value survives, a harmless value
 *   result the caller does not depend on). On the tail path this guard forwards, unread, whatever
 *   the pre-spawn gate leaves behind.
 */

// The position threshold. An actor whose advanced X still sits at or above 0x20 has not yet reached
// the left-edge band where the next wave object is released, so the spawn attempt is deferred; only
// once X has crossed below 0x20 does the guard open. (ROM 0x3618 `cp 0x20`.)
const B_LIMIT = 0x20;

export function enterPreSpawnGateIfBelowLimit(m, b = m.regs.b, rec = m.regs.ix) {
  // Bail branch (ROM 0x3617-0x361a `ld a,b` / `cp 0x20` / `ret nc`). The actor has not yet crossed
  // the 0x20 position line, so nothing spawns this pass. `ld a,b` copies the X byte into A and the
  // subsequent `ret nc` leaves it there, so the guard returns with A = B — a stale carry-through the
  // resolver's caller discards, not a meaningful result.
  if (b >= B_LIMIT) return (m.regs.a = b); // bail: A = B
  // Tail branch (ROM 0x361b `jr 0x365d`). The actor has crossed below 0x20, so hand its own record
  // (rec / IX) to the pre-spawn gate, which weighs the wave population and, when the shape is right,
  // seats a scan window and lets the free-slot spawner release the next object. Because this is a
  // jump rather than a nested call, the gate's result becomes this guard's result and unwinds
  // through the resolver's frame untouched.
  return spawnObjectGatedByArmedActorCount(m, rec); // tail to the pre-spawn gate
}
