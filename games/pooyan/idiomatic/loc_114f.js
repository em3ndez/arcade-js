// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { loc_118d } from "./loc_118d.js";
import {
  SUBSTATE_FIELD1_COUNTER,
  LATCHED_ENEMY_X,
  PLAY_STATE_INDEX,
  SCORE_DRIP_ACCUM,
  TAMPER_STRIKES_HUD_GUARD,
} from "./names.js";

/**
 * loc_114f — main-loop sub-state 5 handler (reached from the sub-state dispatch table).
 *
 * Ticks the sub-state countdown timer SUBSTATE_FIELD1_COUNTER. While it is non-zero, decrement it
 * and return. On expiry: clear a 9-byte block from LATCHED_ENEMY_X, enqueue the silence sound
 * command, and advance PLAY_STATE_INDEX to the next phase. Then, unless SCORE_DRIP_ACCUM plus the
 * tamper guard byte sum to zero, hand off to the object-slot spawn sweep.
 *
 * LIVE-OUT: memory only — the timer cell, or (on expiry) the cleared block, the sound ring, and the
 * phase index; the spawn sweep supplies its own writes. No forced register output (a dispatch-table
 * handler whose caller reloads its registers).
 */

const CLEAR_LEN = 0x09; // bytes cleared from the block base on expiry
const NEXT_PHASE = 0x06; // phase written when the timer expires

export function loc_114f(m) {
  const { mem8 } = m;

  const timer = mem8[SUBSTATE_FIELD1_COUNTER];
  if (timer !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = timer - 1;
    return;
  }

  loc_0010(m, LATCHED_ENEMY_X, 0, CLEAR_LEN);
  queueSoundCommand00(m);
  mem8[PLAY_STATE_INDEX] = NEXT_PHASE;

  const sum = (mem8[SCORE_DRIP_ACCUM] + mem8[TAMPER_STRIKES_HUD_GUARD]) & 0xff;
  if (sum === 0) return;
  loc_118d(m);
}
