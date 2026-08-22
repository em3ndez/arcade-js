// SPDX-License-Identifier: GPL-3.0-only
import { loc_2c58 } from "./loc_2c58.js";
import { loc_0038 } from "./loc_0038.js";
import {
  STATE2_TILE_PAINT_VRAM,
  FIELD_ATTRIB_SRC_A,
  DISPLAY_CMD_0615,
  WAVE_ARRIVAL_COUNTER,
} from "./names.js";
/**
 * loc_2a01 — actor state-2 handler for the record at IX. Reseats the frame-hold, sets the flip
 * bit, paints three tiles, and advances the record state. It then integrity-checks the field
 * attribute source table (an 8-bit sum of 0x20 bytes must total 1); a mismatch TAIL-JUMPS into
 * the hunter state-0 guard, forwarding that guard's caller-skip boolean, while a clean check
 * enqueues the arrival display command and caps the wave-arrival counter at 8.
 *
 * The tamper branch is a tail-jump, not a scan-loop abort, so the epilogue runs ONLY on the clean
 * fall-through. LIVE-OUT: none of its own; it forwards the guard's boolean on the tamper branch.
 */

const HOLD_FIELD = 0x11; //   frame-hold / flag / state record offsets
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
const FRAME_HOLD_RESEED = 0x08;
const FLIP_BIT = 0x80;
const TILE_RUN = 3;
const TILE_STATE2 = 0xbc;
const CKSUM_LEN = 0x20;
const CKSUM_TARGET = 1; //    valid 8-bit sum total
const ARRIVAL_CAP_TRIGGER = 0x09;
const ARRIVAL_CAP_VALUE = 0x08;

export function loc_2a01(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;
  mem8[rec + FLAG_FIELD] |= FLIP_BIT;
  for (let i = 0; i < TILE_RUN; i++) mem8[STATE2_TILE_PAINT_VRAM + i] = TILE_STATE2;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state byte

  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = (sum + mem8[FIELD_ATTRIB_SRC_A + i]) & 0xff;
  if (sum !== CKSUM_TARGET) return loc_2c58(m, rec); // tamper -> tail-jump the hunter guard

  loc_0038(m, DISPLAY_CMD_0615); // enqueue the arrival display command
  if (mem8[WAVE_ARRIVAL_COUNTER] >= ARRIVAL_CAP_TRIGGER) mem8[WAVE_ARRIVAL_COUNTER] = ARRIVAL_CAP_VALUE;
}
