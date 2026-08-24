// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueSoundRun28 } from "./queueSoundRun28.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_7071 } from "./loc_7071.js";
import {
  ROUND_COUNTER,
  LAUNCH_SCRIPT_PTR,
  INTRO_DELAY_CKSUM_WORD,
  INTRO_PHASE_INDEX,
  TAMPER_CHECK_BLOCK_0AC8,
  TAMPER_CHECK_CLONE_6DF9,
  INTRO_SCRIPT_TIMER_TABLE,
} from "./names.js";
/**
 * loc_6db8 — level-intro phase 0. Runs the shared per-frame sound run, picks a script-timer word
 * from INTRO_SCRIPT_TIMER_TABLE indexed by min(7, ROUND_COUNTER>>2), seats it at LAUNCH_SCRIPT_PTR,
 * primes the INTRO_DELAY_CKSUM_WORD delay and advances INTRO_PHASE_INDEX. Then, only when bit2 of
 * ROUND_COUNTER is set, it runs a 96-byte anti-tamper compare of TAMPER_CHECK_BLOCK_0AC8 against
 * its clone TAMPER_CHECK_CLONE_6DF9; any mismatch tails to the tamper-response handler.
 *
 * LIVE-OUT: none (memory only) — a void intro-phase handler.
 */
export function loc_6db8(m) {
  const { mem8, mem16 } = m;

  queueSoundRun28(m);

  const raw = mem8[ROUND_COUNTER] >> 2;
  const index = (raw >= 0x07 ? 0x07 : raw) & 0x07; // clamp to 7
  mem16[LAUNCH_SCRIPT_PTR] = loc_0c45(m, index, INTRO_SCRIPT_TIMER_TABLE);
  mem8[INTRO_DELAY_CKSUM_WORD] = 0x40;
  mem8[INTRO_PHASE_INDEX] = u8(mem8[INTRO_PHASE_INDEX] + 1);

  if (((mem8[ROUND_COUNTER] >> 2) & 1) === 0) return; // ret nc: bit2 clear -> done

  for (let i = 0; i < 0x60; i++) {
    if (mem8[TAMPER_CHECK_CLONE_6DF9 + i] !== mem8[TAMPER_CHECK_BLOCK_0AC8 + i]) {
      return loc_7071(m); // tamper detected -> tamper-response handler
    }
  }
}
