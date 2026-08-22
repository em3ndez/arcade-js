// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0f44 } from "./loc_0f44.js";
import { loc_0038 } from "./loc_0038.js";
import {
  TARGET_GROUP_COUNT,
  HUD_INTRO_DIGITS_BASE,
  INTRO_PHASE_INDEX,
  INTRO_DELAY_CKSUM_WORD,
  PHASE4_TAMPER_ORIG,
  PHASE4_TAMPER_COPY,
  DISPLAY_CMD_0627,
  BONUS_AWARD_DSW,
} from "./names.js";
/**
 * loc_6f9d — level-intro phase 4: latch and scale the target-group count, then self-check the image.
 *
 * Copies the target-group count into the intro HUD cell, then replaces the stored count with five
 * times itself, clears the three HUD cells above it, advances the intro phase, and reprimes the
 * intro delay. It then compares a fixed program block against its data copy byte for byte: on a
 * full match it queues one sound command and one display command; on any mismatch (a tampered
 * image) it wipes the work-RAM page forward from its base, bricking the run.
 *
 * LIVE-OUT: memory only — a tail-dispatched intro-phase handler; no caller reads its registers.
 * The incoming C only sizes the tamper wipe, a path a clean image never takes.
 */

const ROW_STRIDE = 0x20; //     one tilemap row
const CELLS_ABOVE = 0x03; //    HUD cells zeroed above the count cell
const COUNT_SCALE = 0x05; //    the count is replaced by five times itself
const DELAY_RESEED = 0x80; //   value reprimed into the intro delay
const COMPARE_LEN = 0x44; //    bytes compared by the anti-tamper self-check

export function loc_6f9d(m, cReg = m.regs.c) {
  const { mem8 } = m;

  const count = mem8[TARGET_GROUP_COUNT];
  mem8[HUD_INTRO_DIGITS_BASE] = count;
  const laps = count === 0 ? 256 : count; // the 8-bit down-counter wraps a zero to a full 256
  const scaled = (COUNT_SCALE * laps) & 0xff;
  mem8[TARGET_GROUP_COUNT] = scaled;

  let cell = HUD_INTRO_DIGITS_BASE;
  for (let i = 0; i < CELLS_ABOVE; i++) {
    cell = u16(cell - ROW_STRIDE);
    mem8[cell] = 0x00;
  }

  mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1;
  mem8[INTRO_DELAY_CKSUM_WORD] = DELAY_RESEED;

  let mismatchAt = -1;
  for (let k = 0; k < COMPARE_LEN; k++) {
    if (mem8[PHASE4_TAMPER_ORIG + k] !== mem8[PHASE4_TAMPER_COPY + k]) {
      mismatchAt = k;
      break;
    }
  }

  if (mismatchAt < 0) {
    loc_0f44(m);
    loc_0038(m, DISPLAY_CMD_0627);
    return;
  }

  // Tamper wipe: the block-copy count is the compare loop's leftover pair — high byte = bytes not
  // yet compared, low byte = the incoming C; a zero pair means a full 16-bit run.
  let wipeCount = ((COMPARE_LEN - mismatchAt) << 8) | (cReg & 0xff);
  if (wipeCount === 0) wipeCount = 0x10000;
  mem8[BONUS_AWARD_DSW] = 0x00;
  let dst = u16(BONUS_AWARD_DSW + 1);
  for (let i = 0; i < wipeCount; i++) {
    mem8[dst] = 0x00;
    dst = u16(dst + 1);
  }
}
