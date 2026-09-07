// SPDX-License-Identifier: GPL-3.0-only
import { armSubstateAdvanceGate } from "./armSubstateAdvanceGate.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  CURRENT_PLAYER,
  loc_051b,
  PACKED_FLAG_BITMAP,
  loc_401f,
  SEQUENCE_STATE,
  GAME_STATE,
  loc_4006,
  loc_41d1,
} from "./names.js";

const TEMPLATE_BYTES = 32;

/**
 * startGameRoundAndClearScores (ROM 0x04bc) -- the common game/round-start entry.
 *
 * WHAT IT IS
 *   The point where both start paths converge to leave the press-start screen and enter play. It is
 *   reached two ways: as a fall-through from beginGameOnStartButton (the two-player-start path, which
 *   passes the two-player spawn word) and as a jp target from startOnePlayerGame (one-player, which passes
 *   a null spawn word). It records the spawn word, lays down a fresh board template, opens the play gates,
 *   and queues the opening display/score work -- one frame later the machine is running its first playable
 *   frame.
 *
 * ROLE IN THE MACHINE
 *   This is the credit -> play hand-off for GAME_STATE (see mechanisms.md "The press-start screen and the
 *   two start paths"). By the time it returns, GAME_STATE = 3 and SEQUENCE_STATE = 0 have armed the
 *   player-one play-frame handler (runPlayerOnePlayFrame) at its setup sub-state.
 *
 * Grounding: [seen] (names.js ROUTINES 0x04bc). Cells it touches are named there and in mechanisms.md.
 *
 * LIVE-OUT: memory + the command queue. Writes CURRENT_PLAYER (0x400d, 16-bit), PACKED_FLAG_BITMAP
 *   (0x4180, 32 bytes), SEQUENCE_STATE (0x400a)=0, GAME_STATE (0x4005)=3, the mode/sound gate loc_4006
 *   (0x4006)=1 and loc_41d1 (0x41d1)=1, may arm the sub-state gate 0x4195, and appends three command
 *   words. Returns whatever the final enqueueCommandWord returns (the tail delegate).
 */
export function startGameRoundAndClearScores(m, ptr = m.regs.hl) {
  const { mem8, mem16 } = m;

  // Record the player/spawn word. This is a 16-bit store into CURRENT_PLAYER (0x400d): the low byte is the
  // active-player index but the high byte doubles as the two-player flag, so the caller's spawn word both
  // selects the player and seeds the two-player state (null word = one-player game).
  mem16[CURRENT_PLAYER] = ptr;

  // Lay down a fresh board: blit the 32-byte ROM row template at loc_051b (0x051b) into the packed board
  // buffer PACKED_FLAG_BITMAP (0x4180). Play sub-state 2 later unpacks this buffer into the live flag grid,
  // so this is the starting formation for the round.
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[PACKED_FLAG_BITMAP + i] = mem8[loc_051b + i];

  // Optionally arm the sub-state advance gate. Config cell loc_401f (0x401f), latched from IN2_SHADOW at
  // boot, bit0 selects a variant that wants the gate 0x4195 pre-armed; armSubstateAdvanceGate stores the
  // armed marker (3) there for stepAltPlaySubstate6 to test.
  if (mem8[loc_401f] & 1) armSubstateAdvanceGate(m); // config bit0 -> arm the gate

  // Open the play gates: SEQUENCE_STATE (0x400a)=0 rewinds the play sub-state dispatch to its setup slot,
  // GAME_STATE (0x4005)=3 hands the interrupt to runPlayerOnePlayFrame, and the mode/sound gate pair
  // loc_4006 (0x4006, bit0 later enables the queued sound cues) and loc_41d1 (0x41d1) are both raised.
  mem8[SEQUENCE_STATE] = 0;
  mem8[GAME_STATE] = 3;
  mem8[loc_4006] = 1;
  mem8[loc_41d1] = 1;

  // Queue the opening deferred work through the command ring: a channel-6 start cue (arg 4), then two
  // channel-4 score-field clears (arg 0, arg 1) -- the routine's "clear scores" half. The last is returned
  // to the caller as the tail delegate (its enqueue result is this routine's result).
  enqueueCommandWord(m, (6 << 8) | 4);
  enqueueCommandWord(m, 4 << 8);
  return enqueueCommandWord(m, (4 << 8) | 1);
}
