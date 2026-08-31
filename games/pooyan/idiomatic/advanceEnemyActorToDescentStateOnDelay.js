// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829, SHARED_PHASE_GATE, SHARED_PHASE_COUNTDOWN } from "./names.js";
/**
 * advanceEnemyActorToDescentStateOnDelay — the "waiting to drop" handler for one enemy actor.
 * ROM 0x66fd. Grounding: [seen].
 *
 * WHAT IT IS
 *   Every enemy that rides the playfield is tracked by an ACTOR RECORD — a fixed 0x18-byte block
 *   of work RAM (base passed in as `rec`) holding the actor's whole per-frame state. Byte rec+0x02
 *   of that record is the actor's STATE INDEX: a small number that, each frame, selects which of
 *   the actor's state handlers runs. This routine is the handler for state 0 — the initial
 *   "armed but not yet moving" state, in which the actor sits still and waits for its cue to begin
 *   descending.
 *
 * ITS ROLE IN THE MACHINE
 *   Enemies do not each start dropping on their own schedule; the whole group is released together.
 *   Two shared work-RAM bytes coordinate that release:
 *     - SHARED_PHASE_GATE (0x8930)      — a boolean. While it is clear the group is held; it is
 *                                         raised elsewhere (by animateActorGroupGrowShrink) when
 *                                         the group is ready to move.
 *     - SHARED_PHASE_COUNTDOWN (0x892e) — a single countdown shared across the group. Once the gate
 *                                         is open this ticks down one per frame; when it hits zero
 *                                         the actors advance in lockstep, so the group stays in sync.
 *   When the countdown finally expires, this handler pushes the actor out of state 0 by incrementing
 *   rec+0x02 to 1. On the next dispatch that new index routes the record to the descent-step handler
 *   descendEnemyActorAndSeatSpawnSlot — hence "…ToDescentState". Before handing off it seeds the
 *   record fields the descent will start from, arms the descent animation, and stamps the tile id.
 *
 * LIVE-OUT: memory only — the shared countdown (0x892e), and on expiry the actor record fields
 * (rec+2..rec+6, rec+9) plus the animation-pointer bytes (rec+0x0C..rec+0x0E) written through
 * setActorAnimation.
 */

const COUNTDOWN_RELOAD = 0x12; // value the shared countdown is reloaded with once it expires, so the next group step is 0x12 frames away
const PHASE_TILE_ID = 0x2c; // tile id stamped into rec+9 as the actor enters its descent state

export function advanceEnemyActorToDescentStateOnDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Gate check. The group release flag SHARED_PHASE_GATE (0x8930) must be raised before any actor
  // may leave state 0. While it reads clear this actor is held: do nothing and leave the record
  // exactly as it is for the next frame to retry.
  if (mem8[SHARED_PHASE_GATE] === 0) return; // gate clear -> idle

  // Gate is open — tick the shared release timer. SHARED_PHASE_COUNTDOWN (0x892e) is one counter
  // shared by the whole group. While it is still non-zero the group has not yet reached its cue:
  // spend one frame off it (decrement) and wait. Because every actor reads and writes the same
  // byte, they all count down together and will all cross zero on the same frame.
  if (mem8[SHARED_PHASE_COUNTDOWN] !== 0) {
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] - 1;
    return; // still counting
  }

  // Countdown expired: reload the shared timer and advance THIS actor into its descent state.
  // Reload SHARED_PHASE_COUNTDOWN (0x892e) so the next group phase step is COUNTDOWN_RELOAD (0x12)
  // frames out, then bump the state index at rec+0x02 from 0 to 1 — on the next dispatch that new
  // index routes the record to descendEnemyActorAndSeatSpawnSlot, the descent step.
  mem8[SHARED_PHASE_COUNTDOWN] = COUNTDOWN_RELOAD;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;

  // Seed the record fields the descent will read from its start. Clear the two per-record state
  // fields at rec+0x03 and rec+0x05 to zero, seat the actor's Y coordinate (rec+0x04) to 0x15 so
  // the descent begins from a fixed height, and seat rec+0x06 to 0x02.
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x04] = 0x15;
  mem8[rec + 0x06] = 0x02;

  // Arm the descent animation. Point the record's animation-stream pointer (rec+0x0C/0x0D) at the
  // 4-frame sequence ANIM_TABLE_3829 and reset its frame index (rec+0x0E) to 0, so the actor starts
  // playing the descent look from its first frame.
  setActorAnimation(m, rec, ANIM_TABLE_3829);

  // Stamp the descent-state tile id (0x2c) into rec+0x09, the last field the entry into descent sets.
  mem8[rec + 0x09] = PHASE_TILE_ID;
}
