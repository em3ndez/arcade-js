// SPDX-License-Identifier: GPL-3.0-only
import { spawnChildActorIntoFreeSpriteSlot } from "./spawnChildActorIntoFreeSpriteSlot.js";
/**
 * spawnChildActorIfInRange  (ROM 0x1383-0x1388)
 *
 * WHAT IT IS
 *   A tiny range guard that sits directly in front of the child-actor spawn. An enemy actor that
 *   wants a companion object placed beside it does not spawn one on every frame; it spawns only when
 *   it has actually reached its scheduled target column, and only if the value the scheduler hands
 *   over is inside the valid range. This routine is that second test: it inspects the byte B carried
 *   in from the scheduler, and either rejects it (out of range, do nothing) or lets the spawn proceed.
 *
 *   The valid range is "below 0x20". A B of 0x20 or higher is treated as out of range and the spawn
 *   is skipped entirely; anything under 0x20 is a go.
 *
 * ROLE IN THE MACHINE
 *   Reached from the per-actor scheduler matchActorScheduleThenSpawnOrAnimate (ROM 0x12d0): once that
 *   handler decides the record at IX has arrived at its target column, it branches here to decide
 *   whether a companion object is actually spawned this pass. On the in-range path this routine falls
 *   straight through into the free-slot child spawn spawnChildActorIntoFreeSpriteSlot (ROM 0x13bc),
 *   which finds a free record in the five-slot sprite-object pool SPRITE_OBJECT_TABLE (0x8b70), fits
 *   out the parent, and constructs the companion. So this guard is the gate on that whole sequence.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   A. On the out-of-range path A is left holding B itself (the rejected value) and no memory is
 *   touched. On the in-range path A holds whatever the child spawn returns. The caller, which
 *   dispatches on a register value, reads A back either way.
 */

const B_RANGE_LIMIT = 0x20; // B >= this: out of range

export function spawnChildActorIfInRange(m, b = m.regs.b) {
  // Range test (ROM 0x1383 ld a,b / 0x1384 cp 0x20 / 0x1386 ret nc). B is copied into A and compared
  // against the limit 0x20. A value at or above the limit is out of range: the spawn is refused, no
  // record is fitted out, and the routine returns immediately with the rejected value still sitting
  // in A for the register-dispatched caller to read back.
  if (b >= B_RANGE_LIMIT) return (m.regs.a = b);
  // In range (ROM 0x1387 jr 0x13bc). B was a valid child-spawn parameter, so this routine jumps
  // straight into the free-slot child-actor spawn: scan the five-slot sprite-object pool for a free
  // record, stamp the parent, and build the companion. That call's result becomes this routine's own
  // result, so A carries the spawn outcome back to the caller.
  return spawnChildActorIntoFreeSpriteSlot(m);
}
