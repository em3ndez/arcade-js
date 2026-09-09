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

// Packed-decimal add of a byte + addend + carry-in; returns [value, carryOut] matching the NMOS BCD add.
function decAdd(a, v, c) {
  let al = (a & 0x0f) + (v & 0x0f) + c;
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum >= 0x100 ? 1 : 0];
}

/**
 * serviceFrameIrq — the frame interrupt front. Saves the interrupted registers, pulses the coin sound
 * latch while the reload cell is armed, and (only on the 32V beat) bumps the frame counter and its
 * packed-decimal companion. It then reads the two trackball axes, folds each into its accumulator, derives
 * a normalized value for the current object, and drops into the per-object shadow builder. [code]
 *
 * Off-beat it tail-calls the interrupt tail directly. Keeps the shadow-loop and tail calls (dissolved at
 * merge/spine). buildObjectShadowEntry is a second entry into this same machine.
 */
export function serviceFrameIrq(m) {
  const { mem8 } = m;
  // Interrupt prologue: stack the registers the tail restores before it returns.
  m.push8(m.regs.a);
  m.push8(m.regs.x);
  m.push8(m.regs.y);

  if (mem8[SEGMENT_RELOAD_TIMER] !== 0) { mem8[AUDF2] = 0x10; mem8[AUDC2] = 0xaf; }

  // 32V beat gate: bit6 of the input latch. Off-beat, go straight to the tail.
  if ((mem8[IN0] & 0x40) === 0) return accumulateTrackballAndReturnFromIrq(m);

  mem8[loc_8a] = u8(mem8[loc_8a] + 1);
  mem8[loc_00] = u8(mem8[loc_00] + 1);
  if (mem8[loc_00] === 0) {
    mem8[loc_01] = u8(mem8[loc_01] + 1);
    const [fb, carry] = decAdd(mem8[loc_fb], 1, 0);
    mem8[loc_fb] = fb;
    mem8[loc_fc] = decAdd(mem8[loc_fc], 0, carry)[0];
  }

  if (mem8[loc_8a] >= 8) throw new Error("serviceFrameIrq: watchdog hang -- frame counter out of range");
  const limit = mem8[loc_c8];
  if (limit >= 37) throw new Error("serviceFrameIrq: watchdog hang -- object limit out of range");
  if (limit >= 19) mem8[loc_c8] = 18;

  const xObj = mem8[loc_88];
  let axisA = mem8[u16(IN0 + 3)];
  if (xObj === 2) axisA = u8(axisA << 4);

  // Axis 0: step the selector, store the nudged value, fold it into the first accumulator.
  const [y0, a0] = stepAxisBySelectorBits(m, axisA, mem8[TRACKBALL_AXIS0_STEP_STATE]);
  mem8[TRACKBALL_AXIS0_STEP_STATE] = y0;
  mem8[loc_b9] = u8(y0 + mem8[loc_b9]);
  // Axis 1: step from the shifted selector, store, fold the negated nudge into the second accumulator.
  const [y1] = stepAxisBySelectorBits(m, a0, mem8[TRACKBALL_AXIS1_STEP_STATE]);
  mem8[TRACKBALL_AXIS1_STEP_STATE] = y1;
  mem8[loc_bb] = u8(negateA(m, y1) + mem8[loc_bb]);

  // Normalize this object's cell into a wrapped angle, then refresh its palette pair.
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

  return buildObjectShadowEntry(m, 0x0f);
}

/**
 * buildObjectShadowEntry — one pass of the per-object shadow refresh (second entry, index in X). Copies the
 * object's Y into the high shadow row, builds its low shadow row from the $54/$44 fields, latches the sign bit,
 * then derives the value handed to the shadow-store tail. [code]
 */
export function buildObjectShadowEntry(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[u16(SPRITE_SHADOW_VPOS + x)] = mem8[u8(loc_64 + x)];
  let a = mem8[u8(loc_54 + x)];
  let y = 0;
  if (x !== 13) {
    y = mem8[u8(loc_44 + x)];
    if (y & 0x80) a = u8(a + 1);
  }
  mem8[u16(SPRITE_SHADOW_HPOS + x)] = a;
  mem8[SHADOW_SIGN_LATCH] = y & 0x80;

  if ((mem8[IN0] & 0x20) === 0) {
    return storeSpriteShadowEntry(m, x, mem8[u8(loc_34 + x)]);
  }

  const cell = mem8[u8(loc_34 + x)];
  let sub;
  if (x >= 12) {
    sub = cell;
  } else {
    const low6 = cell & 0x3f;
    if (low6 >= 0x30) {
      sub = low6;
    } else {
      const nib = cell & 0x0f;
      mem8[SHADOW_TILE_LOW_NIBBLE] = nib;
      const bits = mem8[u8(loc_64 + x)] & 0x07;
      let acc = 0;
      if (bits !== 0) acc = bits >= 3 && bits <= 5 ? 0x0c : 0x08;
      sub = acc ^ nib;
    }
  }
  return storeSpriteShadowEntry(m, x, sub ^ mem8[SHADOW_SIGN_LATCH]);
}
