// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelSpriteOrientation — refresh a barrel's two sprite MIRROR bits from a packed
 * direction lookup, on a per-barrel countdown: one call in four does the work.
 *
 * The barrel's record base arrives in the index register and a direction code in a byte
 * register, not as parameters. Almost every call just steps the record's own down-counter
 * (+0x0F) and returns; only the call that finds that counter at 1 refreshes the orientation and
 * reloads the counter to 4, so the refresh fires once every four calls for that barrel.
 *
 * On that beat it rewrites the top bit of two record bytes and leaves their low seven bits
 * untouched:
 *   - the sprite tile code (+0x07): bit 7 is the VERTICAL mirror bit.
 *   - the sprite attribute (+0x08): bit 7 is the HORIZONTAL mirror bit.
 * The two new top bits come from a packed 4x2-bit direction lookup keyed by the barrel's
 * CURRENT orientation — its two existing top bits packed as a 2-bit selector, tile code's bit 7
 * high and attribute's bit 7 low — together with the direction code. The lookup returns a small
 * value whose bit 1 becomes the tile code's new top bit and whose bit 0 becomes the attribute's.
 * So the barrel's facing is advanced one step through a table while its tile and its colour,
 * which live in the low bits of the same two bytes, are preserved.
 *
 * NOT CLAIMED: that this is a ROLL. Two mirror bits do not by themselves make a rotation, and the
 * barrel artwork was not decoded — the name says ORIENTATION and stops there.
 *
 * LIVE-OUT: memory-only — the barrel record's countdown, sprite code and sprite attribute.
 */

import { OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js";

/**
 * Per-barrel down-counter that gates the refresh. It fires the orientation refresh when it
 * reaches 1 and is then reloaded to 4, so the refresh runs once per four calls for this barrel.
 */
const OBJ_ORIENT_COUNTDOWN = 0x0f;

export function advanceBarrelSpriteOrientation(m) {
  const { regs, mem } = m;

  // The barrel record and its direction code arrive in registers rather than as arguments.
  const objBase = regs.ix;
  const dirCode = regs.c;

  const counterAddr = (objBase + OBJ_ORIENT_COUNTDOWN) & 0xffff;
  const counter = mem.read8(counterAddr);

  // Not the beat: just step the countdown and leave the orientation alone. (The store
  // truncates, so 0 steps to 0xFF.)
  if (counter !== 1) {
    mem.write8(counterAddr, counter - 1);
    return;
  }

  // The beat: refresh the two orientation bits. Read the current orientation from the
  // two record bytes' top bits and pack them as the lookup selector — tile code's bit 7
  // high, attribute's bit 7 low.
  const codeAddr = (objBase + OBJ_SPRITE_CODE) & 0xffff;
  const attrAddr = (objBase + OBJ_SPRITE_ATTR) & 0xffff;
  const code = mem.read8(codeAddr);
  const attr = mem.read8(attrAddr);
  const selector = (((code >> 7) & 1) << 1) | ((attr >> 7) & 1);

  // Advance the orientation through the table. The result's bit 1 is the tile code's
  // new top bit, its bit 0 is the attribute's new top bit; each byte's low seven bits
  // are preserved.
  const next = nextAnimationStep(0x03 | dirCode, selector).a;
  mem.write8(attrAddr, ((next & 1) << 7) | (attr & 0x7f));
  mem.write8(codeAddr, (((next >> 1) & 1) << 7) | (code & 0x7f));

  // Reload the countdown for the next four-call cycle.
  mem.write8(counterAddr, 0x04);
}
