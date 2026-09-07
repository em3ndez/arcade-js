// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveGatedSoundStepSequence (ROM 0x1327) -- the gated pulse-step sound sequencer.
 *
 * WHAT IT IS
 *   A per-frame ticker that plays out a short decrementing sound sequence, gated by an enable flag. When
 *   armed it fires once every ten eligible frames (a prescaler); on each fire it enqueues a command word
 *   -- opcode 2 carrying the current step value -- into the deferred command queue, then steps the step
 *   counter down. When the step counter drains, the sequence is over: it clears the enable flag and
 *   silences sound write register 3.
 *
 * ROLE IN THE MACHINE
 *   Runs from the play pipeline runGameplayFrameAndAdvanceOnFieldClear. It is armed by handlePlayerHitEvent
 *   (0x12ed) when an enemy shot hits the player: that event sets the enable flag loc_4201 (0x4201) bit0,
 *   loads the prescaler loc_4205 (0x4205) to 10 and the step counter loc_4206 (0x4206) to 4 -- the exact
 *   pair this routine ticks down -- so the sequence is the player-hit sound playing out over ~40 frames.
 *   Emission is deferred: enqueueCommandWord (0x08f2) appends the (channel, param) word to the command
 *   queue, which the display-list drain later vectors to the sound hardware. SOUND_W_REG3 is 0x6803.
 *
 * Grounding: [seen] (names.js cert for 0x1327; role corroborated by handlePlayerHitEvent's arming pair).
 *
 * LIVE-OUT: none returned; the effect is the queued command word(s) and, at end-of-sequence, the cleared
 *   enable flag (0x4201) and silenced sound register 3 (0x6803).
 */
import { loc_4201, loc_4205, loc_4206, SOUND_W_REG3 } from "./names.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

// Command opcode 2 = the sound channel this sequence drives; prescaler reload = 10 eligible frames/fire.
const COMMAND_OPCODE = 2;
const PRESCALE_RELOAD = 10;

export function driveGatedSoundStepSequence(m) {
  const { mem8 } = m;

  // Gate: the sequence only runs while its enable flag is armed. handlePlayerHitEvent sets this bit; the
  // end-of-sequence branch below clears it. Between runs the bit is clear and every frame no-ops here.
  // Disabled unless bit 0 of the enable flag is set.
  if ((mem8[loc_4201] & 0x01) === 0) return;

  // Prescaler: decrement loc_4205 each eligible frame and only proceed on the tenth (when it hits zero),
  // then reload it. This paces the sequence to one emitted step per ten frames.
  // Prescaler: fire only on the tenth eligible frame.
  mem8[loc_4205] = mem8[loc_4205] - 1;
  if (mem8[loc_4205] !== 0) return;
  mem8[loc_4205] = PRESCALE_RELOAD;

  // Emit: read the current step value and enqueue it as command word (opcode 2 << 8 | step), deferring the
  // actual sound write to the command-queue drain. enqueueCommandWord also carries loc_4206 as its target.
  // Emit the current step as a command word, then step the counter down.
  const step = mem8[loc_4206];
  enqueueCommandWord(m, (COMMAND_OPCODE << 8) | step, loc_4206);
  // Step the counter down; while it is still non-zero the sequence keeps playing on later prescaler fires.
  mem8[loc_4206] = step - 1;
  if (mem8[loc_4206] !== 0) return;

  // End of sequence: the step counter drained. Disarm the enable flag and silence sound register 3 so the
  // channel goes quiet until the next hit event re-arms it.
  // Sequence finished: disable and silence.
  mem8[loc_4201] = 0;
  mem8[SOUND_W_REG3] = 0;
}
