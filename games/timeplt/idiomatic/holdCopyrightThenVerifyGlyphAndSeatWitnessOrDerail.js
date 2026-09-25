// SPDX-License-Identifier: GPL-3.0-only
/** holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail — a phase-1 attract sub-step arm. Hold one
 * sequence step for as long as its delay cell counts, restamping the copyright caption and flashing
 * its line on every frame of the wait. On the frame the delay expires, verify the copyright line's
 * colours (deferring to that guard, which derails on its own if they are wrong) and then verify the
 * "(c) KONAMI 1982" caption glyph: a pointer is built from a program byte — the first opcode of the
 * parachutist routine, read as data — which lands on the caption's N cell only on an untouched image,
 * and the glyph there must read 0x3B. If it does not, the sequence DERAILS into the anti-tamper trap
 * (data run as code). Otherwise one caption cell's glyph and colour are seated into the tamper-witness
 * pair and the sequence steps on. LIVE-OUT: memory only.
 *
 * The derived pointer is the tamper mechanism itself: add 2 to the program byte for the low pointer
 * byte, then add 0x6A for the high byte, so a modified opcode moves the read off the caption cell and
 * the glyph test fails. On the genuine image the byte is 0x3A, the pointer lands on the copyright
 * caption's N cell and the glyph is that N, so the derail is unreachable in normal play. */

import { u8, u16 } from "../../../core/int.js";
import { SEQUENCE_DELAY, TAMPER_GLYPH_SOURCE_CELL, TAMPER_GLYPH_COPY, runParachutistSlot_ADDR } from "./names.js";
import { stampCopyrightStrip } from "./stampCopyrightStrip.js";
import { flashCopyrightLine } from "./flashCopyrightLine.js";
import { checkTheCopyrightLineColoursOrDerail } from "./checkTheCopyrightLineColoursOrDerail.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { loc_15ca } from "../translated/loc_15ca.js";

// The N glyph of the "(c) KONAMI 1982" caption line; the check the derived pointer guards.
const KONAMI_GLYPH = 0x3b;
// The two adds that turn the program byte into a caption-cell pointer (low then high byte).
const LOW_BIAS = 0x02;
const HIGH_BIAS = 0x6a;
// Bit 10 crosses the character plane to the colour plane of the same cell (res 2,h).
const CHARACTER_PLANE_BIT = 1 << 10;

export function holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);

  const left = u8(mem8[SEQUENCE_DELAY] - 1);
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;

  checkTheCopyrightLineColoursOrDerail(m);

  const low = u8(mem8[runParachutistSlot_ADDR] + LOW_BIAS);
  const cell = u16((u8(low + HIGH_BIAS) << 8) | low);
  const glyph = mem8[cell];
  // Tampered glyph: the derail reads the registers this arm left standing, so seat them for the
  // frozen trap (born-live fallback). Unreachable on a genuine image.
  if (glyph !== KONAMI_GLYPH) return (m.regs.a = glyph, m.regs.hl = cell, loc_15ca(m));

  const colourCell = TAMPER_GLYPH_SOURCE_CELL & ~CHARACTER_PLANE_BIT;
  mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL];
  mem8[TAMPER_GLYPH_COPY + 1] = mem8[colourCell];
  return advanceSequenceSubStep(m);
}
