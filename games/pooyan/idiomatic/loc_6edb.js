// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6f2d } from "./loc_6f2d.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_0010 } from "./loc_0010.js";
import {
  ENEMY_ACTOR_TABLE,
  LAUNCH_SCRIPT_PTR,
  INTRO_PHASE_INDEX,
  HIT_TALLY,
  TARGET_GROUP_COUNT,
  INTRO_DELAY_CKSUM_WORD,
  ENEMY_TARGET_REC0,
  PROJECTILE_SLOT_STATE,
  PHASE1_COMPLETE_DISPLAY_CMD,
  TARGET_MISMATCH_DISPLAY_CMD,
  TARGET_MATCH_DISPLAY_CMD,
} from "./names.js";
/**
 * loc_6edb — phase-1 per-record driver, then the phase-1 completion check.
 *
 * Runs the per-record state handler over the 14 enemy-actor records (stride 0x18). Phase-1 is only
 * complete once the launch script has reached its 0xff terminator AND all three projectile slots are
 * idle; until then it returns. On completion it advances the intro phase and queues a display
 * command, compares 3x the target-group count against the hit tally — on a match it forces intro
 * phase 4 and swaps the queued command — then reprimes the intro delay, queues that command, and
 * clears the 0x30-byte target block.
 *
 * LIVE-OUT: memory only — the record-scan caller returns straight after and reads no register back.
 */
const RECORD_STRIDE = 0x18; //  actor/projectile record pitch
const ACTOR_COUNT = 0x0e; //    enemy-actor records swept (14)
const SLOT_COUNT = 0x03; //     projectile slots checked for idle
const SCRIPT_TERMINATOR = 0xff; // launch-script end marker
const INTRO_PHASE_FOUR = 0x04; // phase forced on a target/tally match
const INTRO_DELAY_RESEED = 0x40; // value the intro delay is reprimed to
const TARGET_CLEAR_LEN = 0x30; // bytes of the target block cleared to zero

export function loc_6edb(m) {
  const { mem8 } = m;

  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < ACTOR_COUNT; i++) {
    loc_6f2d(m, rec);
    rec = u16(rec + RECORD_STRIDE);
  }

  const script = mem8[LAUNCH_SCRIPT_PTR] | (mem8[u16(LAUNCH_SCRIPT_PTR + 1)] << 8);
  if (mem8[script] !== SCRIPT_TERMINATOR) return; // script not finished

  let slot = PROJECTILE_SLOT_STATE;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (mem8[slot] !== 0) return; // a slot still busy
    slot = u16(slot + RECORD_STRIDE);
  }

  mem8[INTRO_PHASE_INDEX] = (mem8[INTRO_PHASE_INDEX] + 1); // advance the intro phase
  loc_0038(m, PHASE1_COMPLETE_DISPLAY_CMD);

  const target3 = (mem8[TARGET_GROUP_COUNT] * 3) & 0xff; // 3 x target-group count
  let cmd = TARGET_MISMATCH_DISPLAY_CMD;
  if (target3 === mem8[HIT_TALLY]) {
    mem8[INTRO_PHASE_INDEX] = INTRO_PHASE_FOUR; // force phase 4
    cmd = TARGET_MATCH_DISPLAY_CMD;
  }

  mem8[INTRO_DELAY_CKSUM_WORD] = INTRO_DELAY_RESEED;
  loc_0038(m, cmd);
  loc_0010(m, ENEMY_TARGET_REC0, 0x00, TARGET_CLEAR_LEN); // clear the target block to zero
}
