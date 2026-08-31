// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { precheckCollisionBounds } from "./precheckCollisionBounds.js";
import { queueHitSound } from "./queueHitSound.js";
import { FLASH_CELL_BASE } from "./names.js";
/**
 * scanActorSlotsMarkStruckAndFlash — one proximity-collision sweep over a run of actor slots.
 *
 * ROM 0x5f11-0x5f52. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * A single pass of Pooyan's per-frame collision machinery. Given a target box (a small
 * X/Y region on screen) it walks a fixed number of actor slots looking for the first one
 * that overlaps that box. The instant one overlaps, the slot is retired (marked "struck"),
 * a screen-flash cell is lit, the hit sound is requested, and the sweep stops early. If no
 * slot overlaps, the sweep runs the full count of slots and returns having changed nothing.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Collision in Pooyan is a bank of proximity sweeps fired once per frame by the master
 * actor updater. This is one of those sweeps: the caller has already picked a target box
 * and a pair of record cursors, and hands them in. Each candidate actor is described by two
 * parallel records that advance in lockstep at their own strides — a coordinate record
 * (its on-screen X and Y) and a state record (its liveness byte, and the cell the "struck"
 * mark is written back into). A hit here is what makes a shot count against a formation
 * enemy: it takes the enemy out of play, flags the frame for the flash, and plays the sound.
 *
 * HOW A HIT IS DECIDED
 * --------------------
 * A slot is a candidate only when its state byte is neither 0 (empty slot) nor 0x03 (a slot
 * already struck this pass). A live candidate is measured against the target box on two axes:
 * the horizontal gap between the target's X and the actor's biased X must be under 7, and the
 * vertical gap between the target's margined Y and the actor's margined Y must be under 6.
 * Both gaps are absolute values (the sign of the raw subtraction is folded away). An actor
 * that has dropped off the bottom of the visible field is rejected before either test.
 *
 * LIVE-OUT: memory only. On a hit: the struck slot's state byte set to 0x03, the flash cell
 * (0x8d19 or 0x8d1a) set to 0x01, and the hit-sound ring writes left by the sound request.
 * The caller consumes no register result — a miss returns having touched nothing.
 */

// State byte value stamped into a slot once it has been hit: it both records the strike and
// makes the same slot skip itself on any later pass this frame.
const STATE_STRUCK = 0x03;
// Horizontal overlap window: |target X - actor X| must be strictly under this for a hit.
const DX_LIMIT = 0x07;
// Vertical overlap window: |target Y - actor Y| (both margined) must be strictly under this.
const DY_LIMIT = 0x06;
// Vertical margin added to the target's Y before the compare, matching the +8 margin that
// precheckCollisionBounds already folded into the actor's Y so the two are on the same axis.
const Y_MARGIN = 0x08;
// Stride of the coordinate record cursor: successive actors' X/Y records sit 4 bytes apart.
const IX_STRIDE = 0x04;
// Stride of the state record cursor: successive actors' state records sit 0x18 bytes apart.
const HL_STRIDE = 0x18;

/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  return borrow ? (-raw) & 0xff : raw;
}

export function scanActorSlotsMarkStruckAndFlash(m, count = m.regs.b, ix = m.regs.ix, hl = m.regs.hl, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // recA walks the coordinate records (X at +0, Y at +2); recB walks the parallel state
  // records. They start at the two cursors the caller supplied and step together each pass.
  let recA = ix;
  let recB = hl;
  // Slots left to examine; the sweep stops when this reaches zero or the first hit lands.
  let remaining = count;

  for (;;) {
    // Read this slot's liveness byte from the state record. Skip the slot unless it is a
    // live candidate: 0 means an empty slot, STATE_STRUCK (0x03) means one already retired.
    const state = mem8[recB];
    if (state !== 0 && state !== STATE_STRUCK) {
      // Screen the candidate: bias its X for the current screen orientation and margin its Y,
      // and learn whether it is still on screen. An actor off the bottom of the field is not
      // a hit and is skipped here (onScreen false).
      const [e, y, onScreen] = precheckCollisionBounds(m, recA);
      if (onScreen) {
        // Horizontal test: absolute gap between the target box X (IY+0) and the actor's
        // biased X. The subtraction borrows when the target X is below the actor X, in which
        // case absDiff negates the raw result to get |dx|.
        const dx = absDiff((mem8[iy] - e) & 0xff, mem8[iy] < e);
        if (dx < DX_LIMIT) {
          // Vertical test: take the target box Y (IY+2), add the same +8 margin the actor Y
          // already carries so both sit on the shifted axis...
          const yTarget = (mem8[iy + 2] + Y_MARGIN) & 0xff;
          // ...then take the absolute gap |dy| the same borrow-aware way as |dx|.
          const dy = absDiff((yTarget - y) & 0xff, yTarget < y);
          if (dy < DY_LIMIT) {
            // Hit. Both axes overlap, so retire this actor and end the sweep.
            // 1) Stamp the state record struck (0x03): the enemy is out of play and this
            //    slot will skip itself on any remaining pass this frame.
            mem8[recB] = STATE_STRUCK;
            // 2) Light the collision-flash cell. The pair lives at 0x8d19/0x8d1a; the Z80's
            //    interrupt-vector register (I) selects which one — I==0 picks the base cell,
            //    non-zero picks +1 — so alternating frames flash through alternating cells.
            mem8[FLASH_CELL_BASE + (ireg !== 0 ? 1 : 0)] = 0x01; // interrupt parity picks the cell
            // 3) Request the "shot connected" sound and return, abandoning the rest of the
            //    slots: the first hit ends the pass.
            return queueHitSound(m);
          }
        }
      }
    }
    // No hit on this slot: step both cursors to the next actor (coordinate record +4, state
    // record +0x18, each wrapped to 16 bits) and count the slot off.
    recA = u16(recA + IX_STRIDE);
    recB = u16(recB + HL_STRIDE);
    remaining = (remaining - 1) & 0xff;
    // Whole run examined with no overlap found: return having changed nothing.
    if (remaining === 0) return;
  }
}
