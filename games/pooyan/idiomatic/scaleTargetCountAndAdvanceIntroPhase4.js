// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
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
 * scaleTargetCountAndAdvanceIntroPhase4 — level-intro phase 4: latch and scale the target-group
 * count, then self-check the code image.
 *
 * WHAT IT IS
 * ----------
 * ROM 0x6f9d [seen]. One handler in the level-intro / round-start choreography. Between rounds the
 * machine runs a small sequence of intro phases (a phase index selects the handler, and each handler
 * advances the index to the next); this is phase 4. Its job is to finalize how many enemy targets the
 * upcoming board holds and to paint that figure into the intro HUD, and — as this game does at several
 * checkpoints — to sanity-check its own program against a data copy of itself before letting the
 * round proceed.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The target-group count (0x8f47) is the number of enemy targets the board will spawn. This phase
 * copies that raw count into the intro HUD cell for the player to see, then overwrites the stored
 * count with FIVE TIMES itself: from here on the cell no longer holds a group count but a scaled
 * hit-quota that later code compares against the running hit tally to decide the end-of-level bonus.
 * It then blanks the HUD cells above the figure (clearing whatever the previous phase drew there),
 * steps the intro phase index forward, and reprimes the intro delay timer so the next phase gets its
 * full dwell.
 *
 * The tail is an anti-tamper tripwire, the same style used throughout this program. A fixed 0x44-byte
 * block of code (0x6ac5) is compared byte-for-byte against a second, identical copy of those bytes
 * stored as data (0x6fed). On an intact image the two are equal: the routine rewards the match with
 * one sound command and one display command and returns normally. On any mismatch — the signature of
 * a patched or corrupted ROM — it floods the entire work-RAM page from 0x8800 upward with zeros,
 * scrubbing the live game state and bricking the run rather than executing tampered code.
 *
 * GROUNDING: [seen] (per names.js cert for 0x6f9d).
 *
 * LIVE-OUT: memory only. Nothing downstream reads this handler's registers; it is invoked for its
 * writes to the target-count cell, the HUD, the intro phase/delay cells, the sound and display
 * queues, and — only on a tamper hit — the work-RAM wipe. The incoming C register merely sizes that
 * wipe, a path a clean image never reaches.
 */

const ROW_STRIDE = 0x20; //     one tilemap row
const CELLS_ABOVE = 0x03; //    HUD cells zeroed above the count cell
const COUNT_SCALE = 0x05; //    the count is replaced by five times itself
const DELAY_RESEED = 0x80; //   value reprimed into the intro delay
const COMPARE_LEN = 0x44; //    bytes compared by the anti-tamper self-check

export function scaleTargetCountAndAdvanceIntroPhase4(m, cReg = m.regs.c) {
  const { mem8 } = m;

  // --- Latch the target count into the HUD, then scale it into a hit-quota ---
  // Read the target-group count (0x8f47) — how many enemy targets the board holds — and paint that
  // raw figure into the intro HUD digit cell (0x8634) for the player. Then replace the stored count
  // with 5x itself: the hardware forms this as a repeat-add loop counted by the value itself, so a
  // stored 0 counts a full 256 laps (the 8-bit down-counter treats zero as 256) and the product is
  // taken mod 256. After this write, 0x8f47 no longer holds a group count but the scaled hit-quota
  // that end-of-level code checks against the running hit tally to award the bonus.
  const count = mem8[TARGET_GROUP_COUNT];
  mem8[HUD_INTRO_DIGITS_BASE] = count;
  const laps = count === 0 ? 256 : count; // the 8-bit down-counter wraps a zero to a full 256
  const scaled = (COUNT_SCALE * laps) & 0xff;
  mem8[TARGET_GROUP_COUNT] = scaled;

  // --- Clear the three HUD cells directly above the count cell ---
  // Walk upward from the count cell (0x8634) one tilemap row at a time (stride -0x20, wrapped to 16
  // bits) and zero three cells. This erases whatever glyphs a prior intro phase left in the column
  // above the figure so the HUD shows only the freshly latched count.
  let cell = HUD_INTRO_DIGITS_BASE;
  for (let i = 0; i < CELLS_ABOVE; i++) {
    cell = u16(cell - ROW_STRIDE);
    mem8[cell] = 0x00;
  }

  // --- Advance the intro phase and reprime its delay ---
  // Bump the level-intro phase index (0x8f51) so the dispatcher runs the next phase handler on a
  // later frame, and reseed the intro delay timer (0x8f48) to 0x80 so that next phase gets its full
  // countdown before it fires.
  mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1;
  mem8[INTRO_DELAY_CKSUM_WORD] = DELAY_RESEED;

  // --- Anti-tamper self-check: compare the code block against its data copy ---
  // Scan 0x44 bytes of the fixed code block at 0x6ac5 against the identical byte sequence stored as
  // data at 0x6fed. On an intact image every byte matches (mismatchAt stays -1); the first differing
  // byte marks a patched or corrupted image and stops the scan.
  let mismatchAt = -1;
  for (let k = 0; k < COMPARE_LEN; k++) {
    if (mem8[PHASE4_TAMPER_ORIG + k] !== mem8[PHASE4_TAMPER_COPY + k]) {
      mismatchAt = k;
      break;
    }
  }

  // --- Clean image: reward the match and return ---
  // On a full match, queue the phase-4 sound command and enqueue display command 0x0627 (the audio
  // and video the intro phase presents), then return normally so the intro sequence continues.
  if (mismatchAt < 0) {
    queueSoundCommand13(m);
    enqueueDisplayCommand(m, DISPLAY_CMD_0627);
    return;
  }

  // Tamper wipe: the block-copy count is the compare loop's leftover pair — high byte = bytes not
  // yet compared, low byte = the incoming C; a zero pair means a full 16-bit run.
  //
  // A mismatch drops into a block fill that floods work RAM with zeros from 0x8800 upward, one byte
  // at a time. The number of bytes to wipe is whatever the interrupted compare loop left in its
  // 16-bit counter: the high byte is how many of the 0x44 bytes were still uncompared, the low byte
  // is the C register the routine received at entry. A zero pair (nothing left, C=0) means the full
  // 0x10000-byte run. This scrubs the entire live-state page, halting the game on a tampered image.
  let wipeCount = ((COMPARE_LEN - mismatchAt) << 8) | (cReg & 0xff);
  if (wipeCount === 0) wipeCount = 0x10000;
  mem8[BONUS_AWARD_DSW] = 0x00;
  let dst = u16(BONUS_AWARD_DSW + 1);
  for (let i = 0; i < wipeCount; i++) {
    mem8[dst] = 0x00;
    dst = u16(dst + 1);
  }
}
