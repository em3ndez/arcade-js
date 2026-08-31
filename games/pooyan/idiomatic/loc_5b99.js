// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { storeActorAnimationPointer } from "./storeActorAnimationPointer.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import {
  FLIP_SCREEN_FLAG,
  ROUND_COUNTER,
  ENEMY_TARGET_REC0,
  SPRITE_OBJECT_TABLE,
  ANIM_SEQ_5C80,
  ANIM_SEQ_5C89,
  ANIM_SEQ_TABLE_5C92,
  ANIM_SEQ_5CF9,
} from "./names.js";
/**
 * loc_5b99 — proximity/collision test of one actor record against the target pair, plus hit
 * registration.
 *
 * Guards: the record must be armed (or the round-counter's low bit clear), active, flagged and in
 * mode 5. It then tests the two target entries — each must be present and not busy, and within the
 * x and y proximity limits of the record. On a hit it arms the record's animation, marks it struck,
 * then scans the sprite-object table for a slot whose tag matches the record's; a matching slot is
 * armed with an animation too.
 *
 * SEATING: CALLER-SKIP — the hit exits discard this frame so control unwinds past the caller.
 * DISSOLVED to a boolean: true = normal completion (caller continues its sweep), false = a hit
 * occurred and the caller must abort its frame. LIVE-OUT: that boolean only — the caller parks its
 * loop state in the alternate register set across the call.
 */

const REC_STRIDE = 0x18;
const TARGET_COUNT = 2; //     the target pair
const SLOT_COUNT = 5; //       sprite-object table slots
const PRESENT = 0x01; //       byte0 bit0 = entry present
const BUSY = 0x02; //          byte0 bit1 = entry busy
const DX_LIMIT = 0x10;
const DY_LIMIT = 0x09;

// (hi:lo) 16-bit sub-pixel position -> integer pixel (5 fractional bits)
const pixel = (hi, lo) => (((hi << 8) | lo) >> 5) & 0xff;

export function loc_5b99(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // guards
  if (!(mem8[rec + 0x0b] & 0x01) && (mem8[ROUND_COUNTER] & 0x01)) return true; // not armed
  if (!(mem8[rec + 0x00] & 0x01)) return true; // inactive
  if (!(mem8[rec + 0x16] & 0x01)) return true; // flag clear
  if (mem8[rec + 0x02] !== 0x05) return true; //  not mode 5

  const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 0x10 : 0x08;
  const yBias = mem8[ROUND_COUNTER] & 0x01 ? 0x16 : 0x12;
  const recX = pixel(mem8[rec + 0x06], mem8[rec + 0x05]);
  const recY = pixel(mem8[rec + 0x04], mem8[rec + 0x03]);

  for (let t = 0; t < TARGET_COUNT; t++) {
    const target = u16(ENEMY_TARGET_REC0 + t * REC_STRIDE);
    const state = mem8[target];
    if (!(state & PRESENT) || state & BUSY) continue; // absent or busy

    const dx = Math.abs(((recX + xBias) & 0xff) - mem8[target + 0x06]);
    if (dx >= DX_LIMIT) continue; // x gap too large
    const dy = Math.abs(((recY - yBias) & 0xff) - mem8[target + 0x04]);
    if (dy >= DY_LIMIT) continue; // y gap too large

    // hit: arm the record's animation and mark it struck
    setActorAnimation(m, rec, mem8[rec + 0x07] & 0x02 ? ANIM_SEQ_5C89 : ANIM_SEQ_5C80);
    mem8[rec + 0x12] = 0x10;
    mem8[rec + 0x16] = 0x02;

    // scan the sprite-object table for the slot carrying this record's tag
    for (let s = 0; s < SLOT_COUNT; s++) {
      const slot = u16(SPRITE_OBJECT_TABLE + s * REC_STRIDE);
      if (mem8[rec + 0x14] !== mem8[slot + 0x14]) continue;

      const cls = (mem8[rec + 0x07] & 0xf0) >> 4;
      let animPtr = fetchWordFromTableIndex(m, cls, ANIM_SEQ_TABLE_5C92); // table[cls]
      if (mem8[slot + 0x0b] & 0x01) animPtr = ANIM_SEQ_5CF9; // slot override
      mem8[slot + 0x16] = 0x02;
      storeActorAnimationPointer(m, slot, animPtr);
      return false; // hit + matched slot
    }
    return false; // hit, no matching slot
  }

  return true; // no hit
}
