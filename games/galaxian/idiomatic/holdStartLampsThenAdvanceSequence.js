// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdStartLampsThenAdvanceSequence — hold the press-start screen for one step, then advance.
 *
 * WHAT IT IS
 *   Sub-state slot 1 of the post-credit "press start" screen runStartScreenAndLaunchGame
 *   (GAME_STATE=2). It counts down the one-shot step timer loc_4019 and, while that stays nonzero,
 *   keeps the two start-button lamps blinking in step with the credit count; on the timer's
 *   zero-cross it advances the sequence state and wipes the flag-bits block.
 *
 * ROLE IN THE MACHINE
 *   loc_4019 (0x4019) is a per-step countdown independent of the shared dwell cascade
 *   (mechanisms.md "attract / sequence state machine"): armStepCountdownAndTickSequenceTimer
 *   (0x01be) re-arms it each frame elsewhere, and this handler is the one that decrements it and
 *   holds the step until it crosses zero. SEQUENCE_STATE (0x400a) is the sequence step index that
 *   selects which sub-handler runs; bumping it moves the screen to the next sub-state. The
 *   FLAG_BITS_COUNT (128) bytes at FLAG_BITS_BASE (0x4100) are the one-byte-per-bit formation
 *   flag grid, cleared to start the next phase from an empty field.
 *
 * ROM 0x0430.  Grounding: [seen].
 *
 * LIVE-OUT: loc_4019 decremented; while nonzero the start lamps are refreshed and it returns; on
 * zero-cross SEQUENCE_STATE is incremented and the 128-byte 0x4100 flag block is zeroed.
 */
import { driveStartButtonLamps } from "./driveStartButtonLamps.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { loc_4019, SEQUENCE_STATE, FLAG_BITS_BASE } from "./names.js";

const FLAG_BITS_COUNT = 128;

export function holdStartLampsThenAdvanceSequence(m) {
  const { mem8 } = m;

  // Tick the step countdown loc_4019 (8-bit wrap). While it is still running, refresh the
  // start-button lamps from the credit count (they blink to invite play) and hold this step.
  const remaining = (mem8[loc_4019] - 1) & 0xff;
  mem8[loc_4019] = remaining;
  if (remaining !== 0) {
    driveStartButtonLamps(m);
    return;
  }

  // Zero-cross: the hold is over. Advance SEQUENCE_STATE so the next frame runs the following
  // sub-handler, and clear the 128-byte flag-bits grid at FLAG_BITS_BASE for a fresh field.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  fillMemoryBlock(m, FLAG_BITS_BASE, 0, FLAG_BITS_COUNT);
}
