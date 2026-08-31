// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceOverlapScanToNextSlot } from "./advanceOverlapScanToNextSlot.js";
import { retireResetOrEngageObjectRecord } from "./retireResetOrEngageObjectRecord.js";
import { queueSoundCommand09 } from "./queueSoundCommand09.js";
import { FLIP_SCREEN_FLAG, loc_8d45, loc_8c91, loc_8ca9 } from "./names.js";
/**
 * testRecordOverlapRetireOrFlagHit — one pass of the six-slot object-overlap scan.
 *
 * WHAT IT IS
 *   The inner collision test the game runs against a single actor-record slot. The actor world
 *   lives as a flat array of 0x18-byte records; this routine takes one such record and asks a
 *   single yes/no question: does its position box overlap the target box the caller is sweeping
 *   for? The caller drives it once per slot down a six-slot span (a djnz-counted loop), so this is
 *   the body of that loop, not the loop itself.
 *
 * ROLE IN THE MACHINE
 *   Part of the object-proximity collision bank the actor updater fires every frame. Collision in
 *   this game is not a physics pass — it is a set of box-distance tests: for each candidate record
 *   the code takes |dx| and |dy| between the record's on-screen box and a target box, and calls it
 *   a hit when both distances fall inside a small window. This routine is the six-slot variant of
 *   that test, and it also owns the consequence of a hit: a type-3 hit retargets and retires the
 *   record it struck, while any other type raises the two struck-record flag cells and plays the
 *   hit sound so the frame's teardown pass can tear the object down.
 *
 * ROM 0x5fa2  (body 0x5fa2-0x6017, plus the type-3 branch at 0x6025)
 * Grounding: [seen]
 *
 * INPUTS (the caller seeds these registers before the pass):
 *   recPtr (HL) — pointer at the actor record under test; its header byte and state byte are read.
 *   posPtr (IX) — pointer at that record's position box (screen X at +0, screen Y at +2).
 *   slots  (B)  — remaining slot count for the caller's djnz loop, handed straight to the advance.
 *   type   (C)  — the hit-type selector; type 3 is special-cased everywhere below.
 *   target (IY) — pointer at the target box being swept for (its X at +0, Y at +2, low byte selects
 *                 which of the two struck-record flag cells a general hit raises).
 *
 * RETURN CONTRACT (shared with the advance-and-loop latch it tails into):
 *   true  — the sweep may continue: this slot was empty, wrong type, or a miss, and the scan should
 *           move on (the latch returns true once all six slots are exhausted with no hit).
 *   false — a hit: the caller's scan loop must abort. A type-3 hit hands off to the record-retire
 *           handler (which itself aborts the frame); a general hit unwinds two levels up, past the
 *           caller's loop, having already flagged the cells and queued the sound.
 *
 * LIVE-OUT: the boolean result, plus memory — a type-3 hit bumps the tally cell 0x8d45 and lets the
 *   retire handler rewrite the struck record; a general hit sets 0x8c91/0x8ca9 (and each cell's
 *   partner six bytes on) to 1 and enqueues sound command 0x09. The hit-type selector C is preserved
 *   across every advance so the next slot's test sees the same type.
 */

const RECORD_TYPE = 0x05; //    the record's state byte (+2) must be 5 — the only kind this scan considers
const TYPE3_DX = 0x10; //       type-3 X window: |dx| must be < 0x10 (the wider horizontal reach)
const TYPE3_DY = 0x12; //       type-3 Y window: |dy| must be < 0x12
const NEAR_D = 0x08; //         every other type uses the tight 8-pixel window on both axes
const X_BIAS_NORMAL = 0x06; //  screen-flip flag set (normal/upright) -> shift the record's X box +6
const X_BIAS_FLIPPED = 0xfb; // screen-flip flag clear (mirrored) -> shift it -5 (0xfb as an 8-bit add)
const Y_BIAS = 0x08; //         both the record box and the target box carry a fixed +8 Y bias, centering the compare
const TARGET_LOW_A = 0x48; //   target pointer low byte 0x48 = the first target slot -> flag cell 0x8c91; else 0x8ca9
const STRUCK_PARTNER = 0x06; // the struck flag's partner byte sits six bytes on inside the same record

// 8-bit absolute difference: the CPU does this as subtract-then-negate-if-borrow; here it is just |x - y|.
const absDiff = (x, y) => (x >= y ? x - y : y - x);

export function testRecordOverlapRetireOrFlagHit(m, recPtr = m.regs.hl, posPtr = m.regs.ix, slots = m.regs.b, type = m.regs.c, target = m.regs.iy) {
  const { mem8 } = m;

  // Reject the slot before any geometry. A record whose header byte (+0) is zero is an empty slot,
  // and one whose state byte (+2) is not 5 is the wrong kind of object for this scan. Either way,
  // restore the hit-type selector C and tail into the advance-and-loop latch, which steps the
  // pointers to the next slot and re-enters the scan (returning true when the six slots run out).
  if (mem8[recPtr] === 0 || mem8[recPtr + 2] !== RECORD_TYPE) {
    return (m.regs.c = type, advanceOverlapScanToNextSlot(m, posPtr, recPtr, slots, type, target));
  }

  // Build both boxes. The X bias depends on screen orientation: the flip flag at 0x881f (1 = normal
  // upright, 0 = mirrored) chooses +6 or -5 so the record's hitbox tracks the sprite after a screen
  // mirror. The Y box carries a fixed +8 on both sides. The type-3 pass widens the accepted window.
  const tight = type === 0x03;
  const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_NORMAL : X_BIAS_FLIPPED;
  const posX = u8(mem8[posPtr] + xBias);
  const posY = u8(mem8[posPtr + 2] + Y_BIAS);
  const dx = absDiff(mem8[target], posX);
  const dy = absDiff(u8(mem8[target + 2] + Y_BIAS), posY);

  // A miss on either axis ends this slot. Compare each distance to its window — the wider 0x10/0x12
  // pair for a type-3 pass, the tight 8/8 otherwise — and if the box reaches outside the window on
  // X or Y, restore C and advance to the next slot exactly as the reject branch above does.
  if (dx >= (tight ? TYPE3_DX : NEAR_D) || dy >= (tight ? TYPE3_DY : NEAR_D)) {
    return (m.regs.c = type, advanceOverlapScanToNextSlot(m, posPtr, recPtr, slots, type, target));
  }

  if (tight) {
    // Type-3 full overlap: this record was struck. Bump the type-3 result tally at 0x8d45, then hand
    // the record (HL) to the matched-record handler, which retargets onto it and retires/resets it.
    // That handler aborts the frame, so this branch never returns to the caller's scan loop.
    mem8[loc_8d45] = u8(mem8[loc_8d45] + 1);
    return retireResetOrEngageObjectRecord(m, recPtr);
  }

  // General full overlap (any non-type-3 hit): raise the struck-record flag cells so the frame's
  // teardown pass tears the object down. The target pointer's low byte selects which of the two
  // I-parity slots was hit — 0x48 (the first target slot) picks cell 0x8c91, otherwise 0x8ca9 — and
  // both the flag byte and its partner six bytes on are set to 1. Then queue the hit sound (command
  // 0x09) and report the hit, which aborts the caller's scan loop.
  const cell = (target & 0xff) === TARGET_LOW_A ? loc_8c91 : loc_8ca9;
  mem8[cell] = 0x01;
  mem8[cell + STRUCK_PARTNER] = 0x01;
  queueSoundCommand09(m);
  return false;
}
