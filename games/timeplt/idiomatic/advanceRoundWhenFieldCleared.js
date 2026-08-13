// SPDX-License-Identifier: GPL-3.0-only
/** advanceRoundWhenFieldCleared — a gated two-arm state update. It acts only when a mode cell is clear, an arm cell is
 * set, and all fifteen object slots hold zero, and returns at once otherwise. It then queues the
 * fixed sound set and branches on a selector: one arm disarms and zeroes a cluster of cells (a
 * fixed table sum collapses one of them to zero); the other blanks a strided run, copies a
 * sixteen-byte record into one of two banks a cell selects, and marks a phase cell. LIVE-OUT: memory. */

import { loc_5634 } from "./loc_5634.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startNextRound } from "./startNextRound.js";
import { ACTOR_RECORD_SLOT0, ACTOR_SPRITE_Y_SLOT0, ROUND_TRANSITION_HOLD } from "./names.js";
import { KILLS_REMAINING, PLAY_ACTIVE, ACTIVE_PLAYER, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, LIVES_REMAINING, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES } from "./names.js";
import { loc_07d1, loc_16d3, loc_4a35 } from "./names.js";

export function advanceRoundWhenFieldCleared(m) {
  const { mem8 } = m;

  if (mem8[KILLS_REMAINING] !== 0) return;
  if (mem8[ROUND_TRANSITION_HOLD] === 0) return;
  for (let slot = ACTOR_RECORD_SLOT0; slot < ACTOR_RECORD_SLOT0 + 15 * 0x10; slot += 0x10) {
    if (mem8[slot] !== 0) return;
  }

  loc_5634(m);

  if (mem8[PLAY_ACTIVE] === 0) {
    mem8[ROUND_TRANSITION_HOLD] = mem8[loc_07d1];
    hideAllSprites(m);
    mem8[PLAY_ACTIVE] = 0;
    mem8[ACTIVE_PLAYER] = 0;
    mem8[SEQUENCE_PHASE] = mem8[loc_16d3];
    mem8[SEQUENCE_SUBSTEP] = 0;
    return;
  }

  for (let i = 0; i < 23; i++) mem8[ACTOR_SPRITE_Y_SLOT0 + i * 2] = 0;
  startNextRound(m);
  const dest = mem8[ACTIVE_PLAYER] === 0 ? PLAYER_ONE_LIVES : PLAYER_TWO_LIVES;
  for (let i = 0; i < 16; i++) mem8[dest + i] = mem8[LIVES_REMAINING + i];
  mem8[SEQUENCE_SUBSTEP] = mem8[loc_4a35];
}
