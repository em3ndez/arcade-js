// SPDX-License-Identifier: GPL-3.0-only

/**
 * beginGameOnStartButton (ROM 0x0492) — the start-button round launcher.
 *
 * WHAT IT IS
 *   Reached each frame as the tail of the "press start" screen handler (runStartScreenAndLaunchGame,
 *   0x03f2). It reads the debounced start-button inputs and, when a start is requested and paid for, hands
 *   off to the round-start entry.
 *
 * ROLE IN THE MACHINE
 *   IN1_SHADOW (0x4011) is the one-frame-latched copy of input port IN1: bit0 is the 1-player start button
 *   and bit1 the 2-player start button (mechanisms.md "start screen / credit hand-off"). A 1-player start
 *   tails to startOnePlayerGame (0x04f2, which spends one credit itself). A 2-player start needs at least
 *   two credits — loc_4002 is the credit count — so it spends two, copies the 32-byte ROM row template
 *   loc_051b into SAVED_STATE_SNAPSHOT (0x41a0, the player-2 saved-formation block), optionally arms the
 *   substate-advance gate when operator-config byte loc_401f bit0 is set, and enters play through
 *   startGameRoundAndClearScores (0x04bc) with the fixed 2-player spawn word.
 *
 * ROM 0x0492.  Grounding: [seen].
 *
 * LIVE-OUT: delegated. On the 2-player path it writes loc_4002 (credit spend) and SAVED_STATE_SNAPSHOT
 *   (0x41a0..+31); GAME_STATE, SEQUENCE_STATE and the command ring are set by the startGameRoundAndClear-
 *   Scores / startOnePlayerGame it tails into.
 */
import { startOnePlayerGame } from "./startOnePlayerGame.js";
import { armStateAdvanceGate } from "./armStateAdvanceGate.js";
import { startGameRoundAndClearScores } from "./startGameRoundAndClearScores.js";
import { IN1_SHADOW, loc_4002, loc_051b, SAVED_STATE_SNAPSHOT, loc_401f } from "./names.js";

const CREDITS_PER_START = 2;
const TEMPLATE_BYTES = 32;
// SPAWN_PTR is 0x100, the fixed 2-player spawn word handed to startGameRoundAndClearScores.
const SPAWN_PTR = 256;

export function beginGameOnStartButton(m) {
  const { mem8 } = m;

  // Read the latched start-button inputs. bit0 (1-player) wins outright and tails to the 1-player start;
  // if neither the 1-player nor the 2-player (bit1) button is held there is nothing to launch this frame.
  const input = mem8[IN1_SHADOW];
  if (input & 1) return startOnePlayerGame(m); // bit0: one-player start
  if (!(input & 2)) return; // bit1 clear: nothing to launch

  // 2-player start: it costs two credits. Bail if fewer are banked, otherwise spend them from loc_4002.
  if (mem8[loc_4002] < CREDITS_PER_START) return; // fewer than two credits
  mem8[loc_4002] = mem8[loc_4002] - CREDITS_PER_START;

  // Seed player 2's saved formation: blit the 32-byte ROM row template loc_051b into SAVED_STATE_SNAPSHOT
  // (0x41a0), so the second player's board is ready when control switches to game-state 4.
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[SAVED_STATE_SNAPSHOT + i] = mem8[loc_051b + i];

  // Operator-config gate: when loc_401f bit0 is set, arm the substate-advance gate for this round.
  if (mem8[loc_401f] & 1) armStateAdvanceGate(m); // config bit0 -> arm the gate

  // Enter the round: startGameRoundAndClearScores stores the spawn word, sets GAME_STATE=3 / SEQUENCE_STATE=0,
  // and queues the opening cues.
  return startGameRoundAndClearScores(m, SPAWN_PTR);
}
