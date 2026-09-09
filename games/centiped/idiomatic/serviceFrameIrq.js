// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SEGMENT_RELOAD_TIMER,
  AUDF2, AUDC2,
  IN0,
  loc_8a, loc_00, loc_01, loc_fb, loc_fc, loc_c8, loc_88,
  TRACKBALL_AXIS0_STEP_STATE, TRACKBALL_AXIS1_STEP_STATE, loc_b9, loc_bb, loc_c2,
  loc_64, SPRITE_SHADOW_VPOS, loc_54, loc_44, SPRITE_SHADOW_HPOS, SHADOW_SIGN_LATCH, loc_34, SHADOW_TILE_LOW_NIBBLE,
} from "./names.js";
import { loadPaletteRecordPair } from "./loadPaletteRecordPair.js";
import { negateA } from "./negateA.js";
import { stepAxisBySelectorBits } from "./stepAxisBySelectorBits.js";
import { storeSpriteShadowEntry } from "./storeSpriteShadowEntry.js";
import { accumulateTrackballAndReturnFromIrq } from "./accumulateTrackballAndReturnFromIrq.js";

// Packed-decimal (BCD) add of a byte + addend + carry-in, faithfully reproducing the 6502's decimal-mode
// ADC: adjust the low nibble by +6 when it exceeds 9, then the whole byte by +0x60 when it exceeds 0x9F.
// Returns [value, carryOut] so the caller can chain it across a multi-byte decimal counter.
function decAdd(a, v, c) {
  let al = (a & 0x0f) + (v & 0x0f) + c;
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum >= 0x100 ? 1 : 0];
}

/**
 * serviceFrameIrq — the front of the frame interrupt: one pass that keeps a sound cue alive, advances
 * the frame clocks, samples both trackball axes, and drops into the per-object sprite-shadow builder.
 *
 * Role in the machine: this and three companions (`buildObjectShadowEntry`, `storeSpriteShadowEntry`,
 * `accumulateTrackballAndReturnFromIrq`) form one continuous interrupt machine that runs each 32V slot
 * and hands control down a fixed chain. It is fired here as a direct JS call, so there is no interrupt
 * prologue to stack — nothing live to save.
 *
 * Cells: $d2 (SEGMENT_RELOAD_TIMER) gates the coin/segment tone; $8a a short watchdog counter and $00
 * the frame counter (with $01 and the BCD pair $fb/$fc as its wider companions); $c8 an object limit;
 * $88 the current object index; the trackball step-state cells $01b8/$01b9 and accumulators $b9/$bb;
 * $c2+xObj an object angle cell. Grounding: [code]. Live-out: $8a/$00/$01/$fb/$fc, $c8, the trackball
 * step-states and accumulators, $c2+xObj and the object's palette pair, then the sprite-shadow rows.
 */
export function serviceFrameIrq(m) {
  const { mem8 } = m;
  // Fired as a direct JS call (SP retired): no interrupt prologue to stack -- nothing live to save.

  // Keep the segment/coin tone alive: while the shared reload timer is nonzero, load POKEY channel 2
  // with a fixed pitch and volume. This runs on EVERY slot, armed or not, so the tone tracks the timer
  // rather than the frame beat.
  if (mem8[SEGMENT_RELOAD_TIMER] !== 0) { mem8[AUDF2] = 0x10; mem8[AUDC2] = 0xaf; }

  // 32V beat gate: bit6 of the input latch. Off-beat, go straight to the tail.
  // Off the beat there is nothing new to integrate, so pass straight to the interrupt tail.
  if ((mem8[IN0] & 0x40) === 0) return accumulateTrackballAndReturnFromIrq(m);

  // On the beat, advance the frame clocks. The short watchdog counter $8a and the running frame counter
  // $00 both increment; when $00 wraps to zero it carries into $01 and into the packed-decimal companion
  // pair $fb/$fc (bumped through a BCD add), so the frame count is available in decimal form as well.
  mem8[loc_8a] = u8(mem8[loc_8a] + 1);
  mem8[loc_00] = u8(mem8[loc_00] + 1);
  if (mem8[loc_00] === 0) {
    mem8[loc_01] = u8(mem8[loc_01] + 1);
    const [fb, carry] = decAdd(mem8[loc_fb], 1, 0);
    mem8[loc_fb] = fb;
    mem8[loc_fc] = decAdd(mem8[loc_fc], 0, carry)[0];
  }

  // Runaway guards: if the watchdog counter $8a has reached 8, or the object limit $c8 is out of its
  // valid range, treat the frame as hung and halt. A merely-high $c8 is clamped back down to 18.
  if (mem8[loc_8a] >= 8) throw new Error("serviceFrameIrq: watchdog hang -- frame counter out of range");
  const limit = mem8[loc_c8];
  if (limit >= 37) throw new Error("serviceFrameIrq: watchdog hang -- object limit out of range");
  if (limit >= 19) mem8[loc_c8] = 18;

  // Read the trackball. Take the current object index and pull an axis-selector byte from the input port
  // IN0+3; for object 2 pre-shift it left a nibble so the relevant selector bits land in the top of the
  // byte where stepAxisBySelectorBits reads them.
  const xObj = mem8[loc_88];
  let axisA = mem8[u16(IN0 + 3)];
  if (xObj === 2) axisA = u8(axisA << 4);

  // Axis 0: step the selector, store the nudged value, fold it into the first accumulator.
  // stepAxisBySelectorBits decodes the top two selector bits into a one-step nudge of the carried step
  // value and returns the shifted selector byte for the next axis.
  const [y0, a0] = stepAxisBySelectorBits(m, axisA, mem8[TRACKBALL_AXIS0_STEP_STATE]);
  mem8[TRACKBALL_AXIS0_STEP_STATE] = y0;
  mem8[loc_b9] = u8(y0 + mem8[loc_b9]);
  // Axis 1: step from the shifted selector, store, fold the negated nudge into the second accumulator.
  const [y1] = stepAxisBySelectorBits(m, a0, mem8[TRACKBALL_AXIS1_STEP_STATE]);
  mem8[TRACKBALL_AXIS1_STEP_STATE] = y1;
  mem8[loc_bb] = u8(negateA(m, y1) + mem8[loc_bb]);

  // Normalize this object's angle cell into a wrapped angle, then refresh its palette pair. If bit 7 is
  // set the cell is an animating phase counter: advance it by 3 and wrap back to 0 at 42. If instead bit
  // 6 is set the cell is simply masked to its low six bits (a fixed angle). Either way the resulting
  // angle indexes the palette record loaded for the object.
  const cell = mem8[u8(loc_c2 + xObj)];
  if (cell & 0x80) {
    let t = u8((cell & 0x3f) + 3);
    if (t >= 42) t = 0;
    mem8[u8(loc_c2 + xObj)] = t;
    loadPaletteRecordPair(m, t);
  } else if (cell & 0x40) {
    const t = cell & 0x3f;
    mem8[u8(loc_c2 + xObj)] = t;
    loadPaletteRecordPair(m, t);
  }

  // Descend into the per-object shadow builder for the full object range (index seeded to 0x0f).
  return buildObjectShadowEntry(m, 0x0f);
}

/**
 * buildObjectShadowEntry — one object's sprite-shadow refresh, indexed by X (a second entry point into
 * the same interrupt machine; `serviceFrameIrq` falls into it, and the store tail loops back into it).
 *
 * Role in the machine: it builds the four per-object shadow rows the display picks up from RAM. Here it
 * copies the object's Y into the high shadow row, builds the low (horizontal) row from the $54/$44
 * fields, latches the sign bit, and derives the value handed to the shadow-store tail. Under self-test
 * (bit 5 of IN0) it substitutes a derived pattern for the live tile code so the diagnostic can exercise
 * the shadow table. Grounding: [code].
 */
export function buildObjectShadowEntry(m, x = m.regs.x) {
  const { mem8 } = m;

  // Copy the object's vertical field straight into the high shadow row.
  mem8[u16(SPRITE_SHADOW_VPOS + x)] = mem8[u8(loc_64 + x)];

  // Build the horizontal shadow from $54+x, folding in the sign of $44+x (add one when negative) for
  // every object except index 13, and hold that sign bit in the sign latch for use a moment later.
  let a = mem8[u8(loc_54 + x)];
  let y = 0;
  if (x !== 13) {
    y = mem8[u8(loc_44 + x)];
    if (y & 0x80) a = u8(a + 1);
  }
  mem8[u16(SPRITE_SHADOW_HPOS + x)] = a;
  mem8[SHADOW_SIGN_LATCH] = y & 0x80;

  // Normal play (self-test bit 5 of IN0 clear): pass the tile/attribute source $34+x through untouched
  // to the store tail.
  if ((mem8[IN0] & 0x20) === 0) {
    return storeSpriteShadowEntry(m, x, mem8[u8(loc_34 + x)]);
  }

  // Self-test path: derive a substitute value from $34+x rather than using the live tile code.
  const cell = mem8[u8(loc_34 + x)];
  let sub;
  if (x >= 12) {
    // High object slots use the cell as-is.
    sub = cell;
  } else {
    const low6 = cell & 0x3f;
    if (low6 >= 0x30) {
      // Low slots: a value already at or above 0x30 in the low six bits is kept.
      sub = low6;
    } else {
      // Otherwise stash the low nibble and combine it with a small offset chosen from the low three
      // bits of the vertical field $64+x (0x0c for the middle band 3..5, else 0x08), XORing the two.
      const nib = cell & 0x0f;
      mem8[SHADOW_TILE_LOW_NIBBLE] = nib;
      const bits = mem8[u8(loc_64 + x)] & 0x07;
      let acc = 0;
      if (bits !== 0) acc = bits >= 3 && bits <= 5 ? 0x0c : 0x08;
      sub = acc ^ nib;
    }
  }
  // Whatever substitute results is XORed with the held sign latch before being handed to the store tail.
  return storeSpriteShadowEntry(m, x, sub ^ mem8[SHADOW_SIGN_LATCH]);
}
