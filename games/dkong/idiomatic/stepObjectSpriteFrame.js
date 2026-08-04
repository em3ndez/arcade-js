// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectSpriteFrame — advance an object's animation sprite tile on a period-2 timer,
 * flipping a bit at every sixteenth step.
 *
 * Called during the object update for one record of a board-object array; the record is
 * addressed relative to a base pointer, so that base is the parameter. It runs a small
 * two-part animation clock over just two bytes of the record:
 *
 *   - A per-object down-counter (record byte +0x15) counts every call. While it is still
 *     running the routine only ticks it down and stops, so nothing else changes that call.
 *   - When the counter reaches 0 it is reloaded to 2 — which makes the sprite advance on
 *     only every other call — and the object's sprite tile code (OBJ_SPRITE_CODE, +0x07) is
 *     stepped forward by one, animating the object.
 *
 * On the steps whose sprite code comes up with an all-ones low nibble (once every sixteen
 * steps) bit 1 of the code is TOGGLED. Because the low nibble is all-ones at that point bit 1
 * is set, so the toggle clears it — a flip, not a blind set or clear.
 *
 * The name is mechanism-descriptive and asserts no object identity: WHICH object this
 * services is not claimed here.
 *
 * A LEAF: reads and writes only the two record bytes of the object it is handed; calls
 * nothing and returns nothing.
 *
 * LIVE-OUT: memory-only — the record's animation down-counter and its sprite tile code.
 * Both callers reload the accumulator and its flags immediately, so nothing this routine
 * leaves in a register is live.
 */

import { OBJ_SPRITE_CODE } from "./names.js";

// Object-record field: a per-object animation down-counter, reloaded to 2 on expiry so the
// sprite advances every other call. It is object-relative rather than a fixed cell, so it
// carries no shared name.
const OBJ_ANIM_TIMER = 0x15;

/**
 * @param {object} m        the machine (uses m.mem only).
 * @param {number} objBase  base address of the object record to animate.
 * @returns {void}
 */
export function stepObjectSpriteFrame(m, objBase) {
  const { mem } = m;
  const timerAddr = (objBase + OBJ_ANIM_TIMER) & 0xffff;
  const codeAddr = (objBase + OBJ_SPRITE_CODE) & 0xffff;

  // While the animation timer is still counting down, just tick it and do nothing else.
  const timer = mem.read8(timerAddr);
  if (timer !== 0) {
    mem.write8(timerAddr, timer - 1);
    return;
  }

  // Timer expired: reload it to 2 (advance only every other call) and step the sprite tile
  // code forward by one (the store wraps at a byte). Read the stepped code back for the test.
  mem.write8(timerAddr, 0x02);
  mem.write8(codeAddr, mem.read8(codeAddr) + 1);
  const code = mem.read8(codeAddr);

  // Only act on the step whose low nibble is all-ones (every sixteenth step); otherwise done.
  if ((code & 0x0f) !== 0x0f) return;

  // Toggle bit 1 of the tile code — the low nibble is all-ones here, so bit 1 is set and the
  // toggle clears it.
  mem.write8(codeAddr, code ^ 0x02);
}
