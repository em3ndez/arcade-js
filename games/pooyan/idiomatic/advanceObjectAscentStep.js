// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { HUD_INTEGRITY_STRIP_B, ASCENT_CHECKSUM_REF, DISPLAY_CMD_0613 } from "./names.js";
/**
 * advanceObjectAscentStep — object ascent step. Runs the object animation sequencer, then subtracts (rec+9) from
 * the 16-bit position (rec+5):(rec+6). While (rec+6) stays under 0x1b it advances state (rec+2) and
 * runs a two-pass checksum over the HUD_INTEGRITY_STRIP_B tile block (8 bytes at -0x20 stride, then
 * 8 bytes at h-4) accumulated in C against the trailing reference byte; a non-zero result tails to
 * the attract sub-state-0 handler, otherwise it appends display command DISPLAY_CMD_0613. At/over
 * 0x1b it rets early (reached top).
 *
 * LIVE-OUT: none (memory only) — a void ascent handler on the record at IX.
 */
export function advanceObjectAscentStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  const lo = u8(mem8[rec + 5] - mem8[rec + 9]);
  if (mem8[rec + 5] < mem8[rec + 9]) mem8[rec + 6] = u8(mem8[rec + 6] - 1); // borrow into high
  mem8[rec + 5] = lo;
  if (mem8[rec + 6] >= 0x1b) return; // reached the top

  mem8[rec + 2] = u8(mem8[rec + 2] + 1); // advance state

  let h = HUD_INTEGRITY_STRIP_B >> 8;
  let l = HUD_INTEGRITY_STRIP_B & 0xff;
  let de = ASCENT_CHECKSUM_REF;
  let c = 0;
  for (let b = 8; b > 0; b--) { // pass 1: -0x20 stride
    c = u8(mem8[de] + mem8[(h << 8) | l] + c);
    de = u16(de + 1);
    if (l < 0x20) h = u8(h - 1); // borrow
    l = u8(l - 0x20);
  }

  h = u8(h - 4);
  for (let b = 8; b > 0; b--) { // pass 2: +0x20 (l is left unwritten)
    c = u8(mem8[(h << 8) | l] + c);
    if (l + 0x20 > 0xff) h = u8(h + 1); // carry
  }

  if (u8(mem8[de] + c) !== 0) return resetToAttractScreenStart(m); // checksum mismatch -> re-enter
  enqueueDisplayCommand(m, DISPLAY_CMD_0613); // append the display command
}
