// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23de — refresh a moving object's two sprite-orientation bits from a packed
 * direction lookup, on a per-object countdown.  ROM 0x23DE.
 *
 * The caller points at one object record and leaves a direction code in the C
 * register. Almost every call this routine just steps a per-object down-counter
 * (record +0x0F) and returns; only on the call that finds the counter at 1 does it
 * do the real work, then reloads the counter to 4 — so the refresh fires once every
 * four calls per object.
 *
 * On that beat it rewrites the top bit of two record bytes while leaving their low
 * seven bits untouched:
 *   • the sprite tile code (+0x07): bit 7 is the horizontal-flip / facing bit.
 *   • the sprite attribute (+0x08): bit 7 is the attribute's high flip/bank bit.
 * The two new top bits come from a packed 4×2-bit lookup (loc_3009) keyed by the
 * object's CURRENT orientation (its two existing top bits, packed as a 2-bit
 * selector — code's bit 7 high, attribute's bit 7 low) together with the caller's
 * direction code. The lookup returns a small value whose bit 1 becomes the tile
 * code's new top bit and whose bit 0 becomes the attribute's new top bit. So the
 * object's facing/orientation is advanced through a table, and its tile/colour
 * magnitude is preserved.
 *
 * ORACLE BOUNDARY: both callers (branch_2053, shared_1ff6) are still the frozen
 * translated oracle, so they hand the object pointer over in IX and the direction
 * code in C. This reads both from the machine rather than as promoted parameters;
 * that marshalling dissolves once those callers are decompiled. loc_3009's selector
 * input is 0x03 | C, exactly as the oracle forms it before the call.
 *
 * NAME: kept the neutral loc_ — the bit mechanics are pinned to the oracle and the
 * two touched bytes are the named sprite code/attribute fields, but reading this as
 * a facing/flip animator is a [guess] resting on those bit-7 meanings alone, below
 * the routine-name evidence bar. Promote once the direction code and the +0x0F
 * countdown are corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-23de.test.js.
 * GATE:     exhaustive + captured. The path-2 memory effect factors into disjoint bit
 *           fields — the two top bits come from loc_3009(0x03|C, selector) and the low
 *           seven bits pass straight through — so one sweep exhausts (C, selector) over
 *           all 256×4 combos (pinning the looked-up top bits into the right cells) and
 *           two more exhaust the +0x07/+0x08 low-bit passthrough over all 256 values
 *           each; a counter sweep exhausts the down-counter path split and its
 *           decrement. 0x23DE runs continuously in the attract demo (its active-movement
 *           callers fire as objects animate), so real captured dispatches — covering both
 *           the decrement path and the refresh beat — anchor the exhaustive sweep to
 *           in-distribution states. Teeth: swapped output top bits, a swapped selector,
 *           a wrong counter reload, and a dropped low-bit passthrough. The RAM diff
 *           excludes the dead STACK_SCRATCH the oracle's dissolved push16/call bracket
 *           writes on the refresh beat.
 * LIVE-OUT: memory-only. Both callers overwrite the returned value before reading it
 *           (branch_2053 does `inc hl`; shared_1ff6 tail-calls 0x24B4, which reloads
 *           the accumulator from the record first thing), so the oracle's residual
 *           registers/flags and its terminal return are dead ABI.
 * NAMES:    OBJ_SPRITE_CODE (record +0x07), OBJ_SPRITE_ATTR (record +0x08) — from
 *           ram.js. The countdown at record +0x0F has no ram.js offset name yet and
 *           stays a local const here.
 */

import { OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./ram.js";
import { loc_3009 } from "./loc_3009.js"; // ROM 0x3009 — packed 4×2-bit direction lookup

// Per-object down-counter that gates the refresh (record +0x0F). Not named in ram.js
// yet; it fires the orientation refresh when it reaches 1 and is reloaded to 4, so the
// refresh runs once per four calls for this object.
const OBJ_ORIENT_COUNTDOWN = 0x0f;

export function loc_23de(m) {
  const { regs, mem } = m;

  // The caller's object record (IX) and its direction code (C) — oracle boundary:
  // both callers still supply these in registers.
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
  const next = loc_3009(0x03 | dirCode, selector).a;
  mem.write8(attrAddr, ((next & 1) << 7) | (attr & 0x7f));
  mem.write8(codeAddr, (((next >> 1) & 1) << 7) | (code & 0x7f));

  // Reload the countdown for the next four-call cycle.
  mem.write8(counterAddr, 0x04);
}
