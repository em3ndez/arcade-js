// SPDX-License-Identifier: GPL-3.0-only
/** loseLifeAndHandOver — one maintenance step per call: hide the sprite band, start the next round when a
 * flag is set, and queue this frame's fixed sound requests. Then decrement the lives count at the
 * head of the live 16-byte context block and copy that block into whichever of two save slots the
 * active-player selector points at. If lives reached zero, hand off to the game-over banner and
 * stop. Otherwise, when the other player's slot still shows lives, flip the selector, then stamp a
 * constant into one cell and a program-image byte into another. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { enqueueTransitionSoundBurst } from "./enqueueTransitionSoundBurst.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startNextRound } from "./startNextRound.js";
import { postGameOverBanner } from "./postGameOverBanner.js";
import { ROUND_TRANSITION_HOLD, LIVES_REMAINING, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES, ACTIVE_PLAYER, SEQUENCE_DELAY, SEQUENCE_SUBSTEP, HANDOVER_SUBSTEP_SEED } from "./names.js";

const RECORD_LEN = 16;

const STAMP_VALUE = 90;

export function loseLifeAndHandOver(m) {
  const { mem8 } = m;

  hideAllSprites(m);
  if (mem8[ROUND_TRANSITION_HOLD] !== 0) startNextRound(m);
  enqueueTransitionSoundBurst(m);

  const count = u8(mem8[LIVES_REMAINING] - 1);
  mem8[LIVES_REMAINING] = count;
  const dest = mem8[ACTIVE_PLAYER] === 0 ? PLAYER_ONE_LIVES : PLAYER_TWO_LIVES;
  for (let i = 0; i < RECORD_LEN; i++) mem8[dest + i] = mem8[LIVES_REMAINING + i];
  if (count === 0) return postGameOverBanner(m);

  const other = mem8[ACTIVE_PLAYER] === 0 ? PLAYER_TWO_LIVES : PLAYER_ONE_LIVES;
  if (mem8[other] !== 0) mem8[ACTIVE_PLAYER] = (mem8[ACTIVE_PLAYER] + 1) & 1;

  mem8[SEQUENCE_DELAY] = STAMP_VALUE;
  mem8[SEQUENCE_SUBSTEP] = mem8[HANDOVER_SUBSTEP_SEED];
}
