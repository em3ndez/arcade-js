// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0a28 } from "./loc_0a28.js";
import { loc_09f8 } from "./loc_09f8.js";
import { loc_76ea } from "./loc_76ea.js";
import { loc_7442 } from "./loc_7442.js";
import {
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  SCRIPT_STEP_COUNTDOWN,
  SCRIPT_READ_PTR,
  SCRIPT_WRITE_PTR,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
} from "./names.js";
/**
 * typeAttractTextColumn — attract sub-state 5 handler (dispatch-table entry 5).
 *
 * Ticks the attract-animation timer (advancing its 4 phases on wrap) and steps the scripted sprite
 * records every frame. Each SCRIPT_FRAME_TIMER wrap it pulls one script byte and stamps it through
 * the column write pointer, backing that pointer up one tile row. Each SCRIPT_STEP_COUNTDOWN wrap it
 * reseeds the pacing timers, advances the attract sub-state, and folds a 14-row (stride 0x20)
 * checksum of the placed column, verified against the two bytes at INTRO_DELAY_CKSUM_WORD.
 * LIVE-OUT: none (memory only).
 */
const ROW_STRIDE = 0x20; //    one tile row
const CHECKSUM_ROWS = 0x0e; // rows folded into the column checksum

export function typeAttractTextColumn(m) {
  const { mem8 } = m;

  mem8[ANIM_FRAME_COUNTER]--;
  if (mem8[ANIM_FRAME_COUNTER] === 0) loc_0a28(m); // wrap -> advance the 4-phase animation
  loc_09f8(m); // step the scripted sprite records + rebuild the display list

  mem8[SCRIPT_FRAME_TIMER]--;
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return; // act only on the frame-timer wrap
  mem8[SCRIPT_FRAME_TIMER] = 0x02;

  // pull the next script byte, stamp it through the write pointer, then back up one tile row
  let read = mem8[SCRIPT_READ_PTR] | (mem8[SCRIPT_READ_PTR + 1] << 8);
  const cell = mem8[read];
  read = u16(read + 1);
  mem8[SCRIPT_READ_PTR] = read; // low byte (the store truncates)
  mem8[SCRIPT_READ_PTR + 1] = read >> 8;
  let write = mem8[SCRIPT_WRITE_PTR] | (mem8[SCRIPT_WRITE_PTR + 1] << 8);
  mem8[write] = cell;
  write = u16(write - ROW_STRIDE);
  mem8[SCRIPT_WRITE_PTR] = write; // low byte
  mem8[SCRIPT_WRITE_PTR + 1] = write >> 8;

  mem8[SCRIPT_STEP_COUNTDOWN]--;
  if (mem8[SCRIPT_STEP_COUNTDOWN] !== 0) return; // reseed only on the step-counter wrap
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d;
  mem8[SCRIPT_FRAME_TIMER] = 0x14;
  mem8[ATTRACT_SUBSTATE]++;

  // fold a 14-row checksum (stride 0x20) of the placed column into a 16-bit sum
  let ptr = mem8[SCRIPT_WRITE_PTR] | (mem8[SCRIPT_WRITE_PTR + 1] << 8);
  let sum = 0;
  for (let n = 0; n < CHECKSUM_ROWS; n++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + ROW_STRIDE);
  }

  // verify the sum against the two bytes at INTRO_DELAY_CKSUM_WORD; a mismatch takes a tamper redirect
  let ck = mem8[INTRO_DELAY_CKSUM_WORD] | (mem8[INTRO_DELAY_CKSUM_WORD + 1] << 8);
  if (mem8[ck] !== (sum & 0xff)) return loc_7442(m); // low-byte mismatch -> tamper trap
  if (mem8[u16(ck + 1)] !== (sum >> 8)) return loc_76ea(m); // high-byte mismatch -> tamper redirect
  ck = u16(ck + 2);
  mem8[INTRO_DELAY_CKSUM_WORD] = ck; // low byte
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = ck >> 8;
}
