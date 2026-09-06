// SPDX-License-Identifier: GPL-3.0-only
// Credit-gated round-launch dispatch. IN1 bit0 starts a one-player game outright; otherwise IN1 bit1 must
// be set with at least two credits, which it spends to blit the row template into the saved-state snapshot,
// optionally arm the state-advance gate on a config bit, and enter the round start with a fixed spawn pointer.
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { armStateAdvanceGate } from "./armStateAdvanceGate.js";
import { startGameRoundAndClearScores } from "./startGameRoundAndClearScores.js";
import { IN1_SHADOW, loc_4002, loc_051b, SAVED_STATE_SNAPSHOT, loc_401f } from "./names.js";

const CREDITS_PER_START = 2;
const TEMPLATE_BYTES = 32;
const SPAWN_PTR = 256;

export function beginGameOnStartButton(m) {
  const { mem8 } = m;

  const input = mem8[IN1_SHADOW];
  if (input & 1) return startOnePlayerGame(m); // bit0: one-player start
  if (!(input & 2)) return; // bit1 clear: nothing to launch

  if (mem8[loc_4002] < CREDITS_PER_START) return; // fewer than two credits
  mem8[loc_4002] = mem8[loc_4002] - CREDITS_PER_START;

  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[SAVED_STATE_SNAPSHOT + i] = mem8[loc_051b + i];

  if (mem8[loc_401f] & 1) armStateAdvanceGate(m); // config bit0 -> arm the gate

  return startGameRoundAndClearScores(m, SPAWN_PTR);
}
