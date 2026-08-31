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
 * loc_5b99 — per-record proximity/collision test against the enemy-target pair, with hit
 * registration.
 *
 * WHAT IT IS
 *   One step of the object-proximity collision scan. Given a single enemy-actor record (based at
 *   `rec`), it asks a yes/no question: is this actor overlapping either live entry of the
 *   enemy-target pair? When it is, the routine registers the hit — it arms the striking actor's
 *   "hit" animation and stamps the actor struck, then hunts the one sprite-object slot that shares
 *   this record's tag and arms that slot's animation too, so the visual reaction plays on both.
 *
 * ROLE IN THE MACHINE
 *   The per-record body of the six-record collision sweep (scanEnemyRecordsForCollision,
 *   ROM 0x5b86): that driver walks the enemy-actor table and hands each record here in turn. A
 *   clean pass lets the sweep advance to the next record; a registered hit tells the sweep to stop
 *   for this frame (see LIVE-OUT). This is one of the eleven per-record proximity passes the master
 *   actor updater fires every frame. The two things it tests against are the two-entry, I-parity
 *   enemy-target actor-record pair at ENEMY_TARGET_REC0 (0x8c90); the reacting slot it later arms
 *   lives in the 5-slot secondary object pool SPRITE_OBJECT_TABLE (0x8b70).
 *
 * ROM
 *   0x5b99-0x5c74 (the routine ends just below storeActorAnimationPointer at 0x5c75).
 *
 * GROUNDING
 *   The structures this test reads and writes are all tagged [seen]: the enemy-target pair
 *   ENEMY_TARGET_REC0 [seen] (whose byte0 presence bits this routine is cited as exercising), the
 *   SPRITE_OBJECT_TABLE [seen] slot pool, the FLIP_SCREEN_FLAG [seen] and ROUND_COUNTER [seen]
 *   bias inputs, and the hit animations ANIM_SEQ_5C80/5C89, the per-class table ANIM_SEQ_TABLE_5C92
 *   and the override sequence ANIM_SEQ_5CF9 [seen]. Its caller (0x5b86) [seen] and both animation
 *   installers, setActorAnimation (0x381e) [seen] and storeActorAnimationPointer (0x5c75) [seen],
 *   are grounded as well.
 *
 * LIVE-OUT
 *   A boolean, plus memory writes on a hit. The boolean tells the caller how to proceed:
 *     true  = clean pass — no overlap (or a guard failed); the sweep continues to the next record.
 *     false = a hit was registered; the caller must abort its frame.
 *   In the machine that "abort the frame" contract is a two-level unwind: on a hit the routine
 *   drops its own return so control resumes past its immediate caller. On a hit the memory writes
 *   are the real payload — the struck record's animation pointer, its +0x12 hit timer (0x10) and
 *   its +0x16 state byte (0x02 = struck), and for the tag-matched slot its +0x16 state byte (0x02)
 *   and animation pointer. No register/scratch state is handed back to the caller.
 *
 * RECORD LAYOUT (fields read/written here, relative to `rec`)
 *   +0x00 bit0  active flag            +0x0b bit0  armed flag
 *   +0x02       mode/state (hit == 5)  +0x12       hit timer (written 0x10)
 *   +0x03/+0x04 Y position lo/hi       +0x14       tag / collision key
 *   +0x05/+0x06 X position lo/hi       +0x16 bit0  flagged guard (written 0x02 = struck)
 *   +0x07       type byte: bit1 picks the hit animation, high nibble = class index
 */

const REC_STRIDE = 0x18; //    every actor/target/slot record is 0x18 bytes wide
const TARGET_COUNT = 2; //     the enemy-target pair at 0x8c90
const SLOT_COUNT = 5; //       sprite-object table slots at 0x8b70
const PRESENT = 0x01; //       target byte0 bit0 = entry present
const BUSY = 0x02; //          target byte0 bit1 = entry busy (already being handled)
const DX_LIMIT = 0x10; //      horizontal overlap window: |dx| must be < 0x10 pixels
const DY_LIMIT = 0x09; //      vertical overlap window: |dy| must be < 0x09 pixels

// Positions are stored as 16-bit sub-pixel fixed point with 5 fractional bits, so the whole-pixel
// coordinate is the top 11 bits: combine (hi:lo) and shift right by 5, then mask to a screen byte.
const pixel = (hi, lo) => (((hi << 8) | lo) >> 5) & 0xff;

export function loc_5b99(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- guards: only an armed, live, flagged, mode-5 record can score a hit this frame ---
  // Arming is conditional: a record counts as armed if its own +0x0b bit0 is set, OR the round
  // counter's low bit is clear. On an odd round an un-armed record is skipped, throttling how many
  // records can strike per frame.
  if (!(mem8[rec + 0x0b] & 0x01) && (mem8[ROUND_COUNTER] & 0x01)) return true; // not armed
  if (!(mem8[rec + 0x00] & 0x01)) return true; // inactive
  if (!(mem8[rec + 0x16] & 0x01)) return true; // flag clear
  if (mem8[rec + 0x02] !== 0x05) return true; //  not mode 5

  // --- alignment biases: shift the record's hit-point into the target's coordinate frame ---
  // The sprite's reference edge moves with screen orientation, so the X bias widens (0x10) when the
  // screen is flipped and tightens (0x08) upright (FLIP_SCREEN_FLAG at 0x881f). The Y bias is a
  // stage-type variant keyed off the round counter's low bit (ROUND_COUNTER at 0x8907): 0x16 on an
  // odd round, 0x12 otherwise. These land the actor's collision anchor on the target's stored pixel.
  const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 0x10 : 0x08;
  const yBias = mem8[ROUND_COUNTER] & 0x01 ? 0x16 : 0x12;
  // The record's whole-pixel position (X from +0x06/+0x05, Y from +0x04/+0x03).
  const recX = pixel(mem8[rec + 0x06], mem8[rec + 0x05]);
  const recY = pixel(mem8[rec + 0x04], mem8[rec + 0x03]);

  // --- test the record against each of the two enemy-target entries ---
  for (let t = 0; t < TARGET_COUNT; t++) {
    // Entry t sits at ENEMY_TARGET_REC0 (0x8c90) + t*0x18. Byte0 carries its presence/state bits.
    const target = u16(ENEMY_TARGET_REC0 + t * REC_STRIDE);
    const state = mem8[target];
    if (!(state & PRESENT) || state & BUSY) continue; // absent or busy

    // X overlap: bias the record's X, wrap to a byte, and measure the gap to the target's X (+0x06).
    const dx = Math.abs(((recX + xBias) & 0xff) - mem8[target + 0x06]);
    if (dx >= DX_LIMIT) continue; // x gap too large
    // Y overlap: the Y bias is subtracted (the anchor sits above the stored point), gap to +0x04.
    const dy = Math.abs(((recY - yBias) & 0xff) - mem8[target + 0x04]);
    if (dy >= DY_LIMIT) continue; // y gap too large

    // --- hit: arm the record's own reaction and stamp it struck ---
    // Point the record at its hit animation — the alternate sequence (5C89) when +0x07 bit1 is set,
    // otherwise the default (5C80) — then set the hit timer and flip the state byte to "struck"
    // (0x02, which also clears the +0x16 bit0 flag so this record cannot re-fire the guard above).
    setActorAnimation(m, rec, mem8[rec + 0x07] & 0x02 ? ANIM_SEQ_5C89 : ANIM_SEQ_5C80);
    mem8[rec + 0x12] = 0x10;
    mem8[rec + 0x16] = 0x02;

    // --- find and arm the sprite-object slot that represents this record on screen ---
    // The visible reaction plays through the secondary object pool: scan its five slots for the one
    // whose tag (+0x14) equals this record's, so the animation is armed on the matching sprite.
    for (let s = 0; s < SLOT_COUNT; s++) {
      const slot = u16(SPRITE_OBJECT_TABLE + s * REC_STRIDE);
      if (mem8[rec + 0x14] !== mem8[slot + 0x14]) continue;

      // Pick the slot's animation from the per-class table (ANIM_SEQ_TABLE_5C92 at 0x5c92), indexed
      // by the record's class (high nibble of +0x07). A slot flagged at its +0x0b bit0 overrides to
      // the shared sequence 0x5cf9 instead of its class default.
      const cls = (mem8[rec + 0x07] & 0xf0) >> 4;
      let animPtr = fetchWordFromTableIndex(m, cls, ANIM_SEQ_TABLE_5C92); // table[cls]
      if (mem8[slot + 0x0b] & 0x01) animPtr = ANIM_SEQ_5CF9; // slot override
      // Mark the slot struck and install its chosen animation (resetting its frame index).
      mem8[slot + 0x16] = 0x02;
      storeActorAnimationPointer(m, slot, animPtr);
      return false; // hit + matched slot
    }
    // The record was struck but no slot carried its tag — still a hit; abort the caller's frame.
    return false; // hit, no matching slot
  }

  // Neither target overlapped this record: a clean pass, the sweep moves on to the next record.
  return true; // no hit
}
