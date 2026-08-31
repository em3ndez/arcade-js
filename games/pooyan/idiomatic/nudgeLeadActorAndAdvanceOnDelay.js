// SPDX-License-Identifier: GPL-3.0-only
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { ACTOR_TABLE, SHAPE_TABLE_26C5 } from "./names.js";
/**
 * nudgeLeadActorAndAdvanceOnDelay — state-2 step of the lead actor's own little state machine.
 * ROM 0x2497-0x24b8.  Grounding: [seen].
 *
 * WHAT IT IS
 *   Every moving thing on screen owns one fixed-width (0x18-byte) record in the actor arena based at
 *   ACTOR_TABLE (0x8a80); slot 0, the record at 0x8a80 itself, is the player/lead actor.  Each lead
 *   record carries a small state index at field +0x02, and once per frame a driver reads the low bits
 *   of that index and hands the record to one of six handlers — a six-step animation the lead actor
 *   walks through (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0).  This routine is the handler for STATE 2.  Its job
 *   is to sit on a frame-delay timer, and once that timer runs out, repaint the lead actor's shape,
 *   shove it a notch further along its path, and promote it to the next state of the sequence.
 *
 * ROLE IN THE MACHINE
 *   It is one entry (index 2) in the lead actor's six-way state dispatch, sitting between the state-1
 *   drop step and the state-3 descent-to-landing step.  Like its neighbours it is a delayed transition:
 *   it does nothing visible for a run of frames (the timer ticking down), then on expiry it fires once
 *   — restyling the actor group's tiles and nudging the lead record's coordinates — and moves the lead
 *   actor on to the next stage of the animation.  The record base is always the fixed lead-actor slot
 *   at 0x8a80, so the coordinate nudge below is aimed straight at that slot.
 *
 * LIVE-OUT
 *   A = the lead record's new secondary coordinate (field +0x06) after the final subtract, for a caller
 *   that reads it out of the register.  The still-counting early return leaves A untouched — that path
 *   only writes the decremented timer back to memory.
 */

export function nudgeLeadActorAndAdvanceOnDelay(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Frame-delay countdown (ROM 0x2497, `dec (ix+0x11)`).  Field +0x11 is the frame-delay timer the
  // lead-actor handlers use to pace their transitions: each frame this state runs, it ticks the timer
  // down by one and, while it is still above zero (ROM 0x249a, `ret nz`), returns immediately so the
  // actor holds its current shape and position.  Nothing else happens until the timer reaches zero.
  const delay = (mem8[ix + 0x11] - 1) & 0xff;
  mem8[ix + 0x11] = delay;
  if (delay !== 0) return; // still counting down this frame

  // Timer expired: promote the lead actor to its next state (ROM 0x249b, `inc (ix+0x02)`).  The state
  // index at +0x02 is what the per-frame driver masks and dispatches on, so bumping it from 2 to 3
  // hands the lead actor to the state-3 descent-to-landing handler on the next frame.
  mem8[ix + 0x02] = mem8[ix + 0x02] + 1; // advance the actor state (byte wraps)

  // Restyle the actor group (ROM 0x24a1, `ld hl,0x26c5` then `call 0x250f`).  SHAPE_TABLE_26C5 (0x26c5)
  // is a ROM shape row; the pattern-A shape loader repaints four consecutive actor records' display
  // bytes from it, giving the lead actor its new on-screen appearance for this leg of the sequence.
  seedFourRecordsAndCopyDisplayTiles(m, SHAPE_TABLE_26C5, ix);

  // Nudge the lead record's position (ROM 0x24a8 reseats the pointer to the fixed lead-actor slot
  // 0x8a80, hence ACTOR_TABLE here).  First the base-Y coordinate (field +0x04, the actor's vertical
  // position) advances by 4 (ROM 0x24a8-0x24b0, `ld a,(ix+0x04)` / `add 0x04` / `ld (ix+0x04),a`),
  // stepping the actor along its path one notch this frame.
  mem8[ACTOR_TABLE + 0x04] = mem8[ACTOR_TABLE + 0x04] + 0x04; // base Y += 4 (byte wraps)

  // Then the secondary coordinate (field +0x06) drops by 6 (ROM 0x24b0-0x24b8, `ld a,(ix+0x06)` /
  // `sub 0x06` / `ld (ix+0x06),a`), the companion nudge that keeps the actor tracking its path.
  const secondary = (mem8[ACTOR_TABLE + 0x06] - 0x06) & 0xff;
  mem8[ACTOR_TABLE + 0x06] = secondary;
  return (m.regs.a = secondary); // A live-out: the new secondary coordinate
}
