// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { paintAttractColumnWithTamperChecksum } from "./paintAttractColumnWithTamperChecksum.js";
import {
  INTRO_DELAY_CKSUM_WORD,
  HIT_TALLY,
  HUNTER_SPAWN_DISPLAY_CMD,
  BOARD_CLEAR_FLAG,
  ROUND_COUNTER,
  TAMPER_CHECK_BLOCK_0B32,
  TAMPER_CHECK_CLONE_7071,
  INTRO_PHASE_INDEX,
} from "./names.js";
/**
 * advanceLevelIntroFromPhase3 — level-intro phase-3 timing gate.
 *
 * While the phase delay holds exactly 0x20 it ticks a secondary sub-count, queuing a sound each step
 * and holding while the board-clear flag is set. Once the delay itself counts down to zero it reloads
 * to 0x60 and — only on world 3 (round == 3) — runs a 0x79-byte anti-tamper compare of one block
 * against its clone, jumping to the tamper handler on any mismatch. Finally it advances the intro
 * phase by writing phase index = 6.
 *
 * LIVE-OUT: none — an intro-phase handler; the dispatch reads only memory back.
 * The tamper arm tail-calls the tamper handler; it is unreachable on an intact image (the clone
 * matches; program-image writes throw so a mismatch cannot be crafted).
 */

const DELAY_ACTIVE = 0x20; //  tick the sub-count only while the delay reads exactly 0x20
const DELAY_RELOAD = 0x60; //  reload value once the delay expires
const WORLD_3 = 0x03; //       anti-tamper compare runs only on world 3
const TAMPER_LEN = 0x79; //    bytes compared
const PHASE_6 = 0x06; //       intro phase advanced to

export function advanceLevelIntroFromPhase3(m) {
  const { mem8 } = m;

  if (mem8[INTRO_DELAY_CKSUM_WORD] === DELAY_ACTIVE && mem8[HIT_TALLY] !== 0) {
    enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD); // queue the hunter-spawn sound
    if (mem8[BOARD_CLEAR_FLAG] !== 0) return; // held while the board is clearing
    const sub = (mem8[HIT_TALLY] - 1) & 0xff;
    mem8[HIT_TALLY] = sub;
    if (sub !== 0) return; // sub-count still running
  }

  const delay = (mem8[INTRO_DELAY_CKSUM_WORD] - 1) & 0xff;
  mem8[INTRO_DELAY_CKSUM_WORD] = delay;
  if (delay !== 0) return; // phase delay still running
  mem8[INTRO_DELAY_CKSUM_WORD] = DELAY_RELOAD;

  if (mem8[ROUND_COUNTER] === WORLD_3) {
    for (let i = 0; i < TAMPER_LEN; i++) {
      if (mem8[TAMPER_CHECK_CLONE_7071 + i] !== mem8[TAMPER_CHECK_BLOCK_0B32 + i]) {
        return paintAttractColumnWithTamperChecksum(m); // tamper mismatch -> tamper handler
      }
    }
  }

  mem8[INTRO_PHASE_INDEX] = PHASE_6; // advance to phase 6
}
