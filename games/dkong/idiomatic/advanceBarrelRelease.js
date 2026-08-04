// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelRelease — the frame-gated step of the barrel string/sprite renderer.
 *
 * Runs once per renderer tick, but only DOES anything every 24th frame: a down-counter is
 * decremented on every entry and the routine returns until it underflows.
 *
 * On the acting frame it reloads the gate and reads an animation sub-counter:
 *   - Sub-counter zero — just render the next character and stop there.
 *   - Sub-counter non-zero — select a 40-byte record from the animation table. Bit 0 of the
 *     barrel slot-claim mode byte decides whether the record index is the sub-counter itself
 *     (bit set) or one less (bit clear), and the chosen record is copied into the sprite-object
 *     block. The sub-counter is then stepped down: while it stays non-zero, render the next
 *     character; when it reaches zero, shorten the gate to a single frame and branch on that same
 *     parity bit — set restarts the fixed source string, clear renders the next character.
 *
 * NOT CLAIMED: which of the two barrel kinds the record being dressed belongs to. The mode byte's
 * bit 0 is read here as a parity selector only; what the two kinds ARE is settled elsewhere.
 *
 * LIVE-OUT: memory-only — the gate and sub-counter cells, plus everything the copy and the two
 * render tails write.
 */

import { BARREL_CLAIM_MODE } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { loc_2d51 } from "./loc_2d51.js";
import { loc_2d83 } from "./loc_2d83.js";

const FRAME_GATE = 0x62af;     // per-tick down-counter; the body acts once every 24 frames
const ANIM_COUNTER = 0x638f;   // animation sub-counter: selects the record and counts down
const ANIM_TABLE = 0x3932;     // base of the 40-byte-per-record animation table in program data
const RECORD_STRIDE = 40;      // bytes per table record (ten sprite records of four bytes)

export function advanceBarrelRelease(m) {
  const { regs, mem } = m;

  // Frame gate: decrement every entry; return until it underflows to zero.
  const gate = (mem.read8(FRAME_GATE) - 1) & 0xff;
  mem.write8(FRAME_GATE, gate);
  if (gate !== 0) return; // not this frame's turn

  // Acting frame: reload the gate for the next cycle.
  mem.write8(FRAME_GATE, 0x18);

  // Zero sub-counter -> render the next character directly.
  const counter = mem.read8(ANIM_COUNTER);
  if (counter === 0) return loc_2d51(m);

  // Select the animation-table record. bit0 of the slot-claim mode byte decides whether the
  // record index is the sub-counter itself or one less; index*40 is taken 8-bit.
  let index = counter;
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) === 0) {
    index = (index - 1) & 0xff;
  }
  const source = (ANIM_TABLE + ((index * RECORD_STRIDE) & 0xff)) & 0xffff;

  // Copy that 40-byte record into the sprite-object block. The copy reads its source from the
  // pointer register, so hand it the record address.
  regs.hl = source;
  loadSpriteObjectBlock(m);

  // Step the sub-counter. While it stays non-zero, render the next character.
  const stepped = (mem.read8(ANIM_COUNTER) - 1) & 0xff;
  mem.write8(ANIM_COUNTER, stepped);
  if (stepped !== 0) return loc_2d51(m);

  // Sub-counter reached zero: shorten the gate to one frame, then branch on that same bit 0
  // — set restarts the fixed source string, clear renders the next character.
  mem.write8(FRAME_GATE, 0x01);
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x01) !== 0) return loc_2d83(m);
  return loc_2d51(m);
}
