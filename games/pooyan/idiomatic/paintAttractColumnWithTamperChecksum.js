// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0a28 } from "./loc_0a28.js";
import { loc_09f8 } from "./loc_09f8.js";
import { loc_76ea } from "./loc_76ea.js";
import {
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  SCRIPT_READ_PTR,
  SCRIPT_STEP_COUNTDOWN,
  SCRIPT_WRITE_PTR,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
} from "./names.js";
/**
 * paintAttractColumnWithTamperChecksum — anti-tamper clone of the attract sub-state 5 handler. Byte-identical to that handler;
 * reached only when the state-3 guard's conditional jump fires (i.e. the original copy has been patched).
 *
 * Ticks the animation frame counter (repaint on wrap), advances the scripted sprite
 * step, then on each SCRIPT_FRAME_TIMER expiry copies one byte from the SCRIPT_READ_PTR
 * cursor through the SCRIPT_WRITE_PTR cursor, backing the write cursor up one 0x20 row. Every
 * SCRIPT_STEP_COUNTDOWN expiry reseeds both timers, bumps ATTRACT_SUBSTATE, and rolls a 14-row
 * (stride 0x20) checksum of the placed column into a 16-bit accumulator, verified against the two
 * bytes at the INTRO_DELAY_CKSUM_WORD pointer; a low-byte miss tails to the tamper dispatcher,
 * a high-byte miss to the tamper handler, and a clean pass advances the check pointer past both bytes.
 *
 * LIVE-OUT: none — a void frame step; every effect is a memory write or a tail dispatch.
 */
const CKSUM_ROWS = 0x0e;
const ROW_STRIDE = 0x20;

export function paintAttractColumnWithTamperChecksum(m) {
  const { mem8, mem16 } = m;

  mem8[ANIM_FRAME_COUNTER]--; // frame countdown
  if (mem8[ANIM_FRAME_COUNTER] === 0) loc_0a28(m); // wrap -> reseed + repaint
  loc_09f8(m); // advance the scripted sprite step

  mem8[SCRIPT_FRAME_TIMER]--;
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return; // timer still running -> wait
  mem8[SCRIPT_FRAME_TIMER] = 0x02; // reload

  const src = mem16[SCRIPT_READ_PTR]; // pull the next script byte
  const b = mem8[src];
  mem16[SCRIPT_READ_PTR] = u16(src + 1);
  const dst = mem16[SCRIPT_WRITE_PTR]; // place it, then back the write cursor up one row
  mem8[dst] = b;
  mem16[SCRIPT_WRITE_PTR] = u16(dst - ROW_STRIDE);

  mem8[SCRIPT_STEP_COUNTDOWN]--;
  if (mem8[SCRIPT_STEP_COUNTDOWN] !== 0) return; // step countdown still running
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d; // reseed the step + frame timers
  mem8[SCRIPT_FRAME_TIMER] = 0x14;
  mem8[ATTRACT_SUBSTATE]++; // advance the attract sub-state

  let ptr = mem16[SCRIPT_WRITE_PTR]; // 14-row stride-0x20 checksum into a 16-bit accumulator
  let sum = 0;
  for (let row = 0; row < CKSUM_ROWS; row++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + ROW_STRIDE);
  }

  let cksum = mem16[INTRO_DELAY_CKSUM_WORD]; // verify against the two stored bytes
  if (mem8[cksum] !== (sum & 0xff)) return m.call(0x7442); // low-byte miss -> tamper dispatcher
  cksum = u16(cksum + 1);
  if (mem8[cksum] !== (sum >> 8)) return loc_76ea(m); // high-byte miss -> tamper handler
  mem16[INTRO_DELAY_CKSUM_WORD] = u16(cksum + 1); // clean pass -> advance the check pointer
}
