// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import { loc_0010 } from "./loc_0010.js";
import {
  SPAWN_PHASE_COUNTER,
  ROPE_DRAW_COUNT,
  FORMATION_SLOT_TABLE,
  TAMPER_OBJECT_FREEZE_FLAG,
  ANIM_SCRIPT_CURSOR,
  SECONDARY_TEARDOWN_FLAG,
  FORMATION_SPAWN_TIMER,
  LEAD_ACTOR_STATE,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  HIT_TALLY,
  ANIM_ARMED_LATCH,
} from "./names.js";
/**
 * resetBoardRamAndReseedSpawnCounters — board/HUD reset.
 *
 * Enqueues one display command (opcode 0x08, low byte from the incoming E). When the spawn-phase
 * counter has reached its cap it reseeds the phase + rope-draw counters to 4 and fills the formation
 * slot table with the freeze flag. It then fills three more RAM blocks with that same value and
 * mirrors it into five actor/HUD cells. The fill value is 0 unless the reseed branch ran.
 *
 * LIVE-OUT: A = the fill value (0, or the freeze flag on the reseed branch); HL = the last fill's
 * advanced pointer and B = 0, both left by the final rst-0x10 fill.
 */

const RESET_CMD_HI = 0x08; //     display-command opcode enqueued at entry
const PHASE_CAP = 0x07; //        spawn-phase value at/above which the reseed branch runs
const PHASE_RESEED = 0x04; //     value reseeded into the phase + rope-draw counters
const FORMATION_SLOTS_LEN = 0x20; // bytes filled at the formation slot table (reseed branch)
const ANIM_CURSOR_LEN = 0x4f; //  bytes filled at the animation-script cursor block
const TEARDOWN_LEN = 0x04; //     bytes filled at the secondary-teardown block
const SPAWN_TIMER_LEN = 0x03; //  bytes filled at the formation-spawn-timer block

export function resetBoardRamAndReseedSpawnCounters(m, cmdLow = m.regs.e) {
  const { mem8 } = m;

  loc_0038(m, (RESET_CMD_HI << 8) | (cmdLow & 0xff));

  let fill = 0;
  if (mem8[SPAWN_PHASE_COUNTER] >= PHASE_CAP) {
    fill = mem8[TAMPER_OBJECT_FREEZE_FLAG];
    mem8[SPAWN_PHASE_COUNTER] = PHASE_RESEED;
    mem8[ROPE_DRAW_COUNT] = PHASE_RESEED;
    loc_0010(m, FORMATION_SLOT_TABLE, fill, FORMATION_SLOTS_LEN);
  }

  loc_0010(m, ANIM_SCRIPT_CURSOR, fill, ANIM_CURSOR_LEN);
  loc_0010(m, SECONDARY_TEARDOWN_FLAG, fill, TEARDOWN_LEN);
  loc_0010(m, FORMATION_SPAWN_TIMER, fill, SPAWN_TIMER_LEN);

  mem8[LEAD_ACTOR_STATE] = fill;
  mem8[ENEMY_TARGET_REC0] = fill;
  mem8[ENEMY_TARGET_REC1] = fill;
  mem8[HIT_TALLY] = fill;
  mem8[ANIM_ARMED_LATCH] = fill;

  return (m.regs.a = fill); // A live-out: the value mirrored into the cells above
}
