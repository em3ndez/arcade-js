// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSoundCounterAndStagePitch (ROM 0x17f9) -- the tail of the sound-counter manager.
 *
 * WHAT IT IS
 *   The Z80 sound-counter manager advanceSoundSweepAndStagePitch (0x17e5) falls straight through into
 *   this routine, so it is really the second half of one routine: the part that ages the sound counter
 *   and then stages a pitch. It is reached with the count already in A and the working pointer in HL.
 *
 * ROLE IN THE MACHINE
 *   Entered by fall-through from advanceSoundSweepAndStagePitch. When the count handed in A is still
 *   running (nonzero) it decrements the sound counter cell loc_41c4 (0x41c4) and stores the aged value
 *   back; when the count is already zero the counter is left parked. Either way it tail-calls the pitch
 *   dispatcher stageSoundPitchBySelector (0x1801), which reads the low two bits of the byte at the
 *   pointer (cell) and, from them plus loc_41c4, stages SOUND_PITCH (0x41c1) for the driver to latch out
 *   later in the frame.
 *
 * Grounding: [seen] (names.js cert for 0x17f9; sweep/counter chain described in mechanisms.md
 * "The sweep voice").
 *
 * LIVE-OUT: loc_41c4 (0x41c4) aged by one when count != 0; SOUND_PITCH (0x41c1) staged by the delegate.
 */
import { u8 } from "../../../core/int.js";
import { loc_41c4 } from "./names.js";
import { stageSoundPitchBySelector } from "./stageSoundPitchBySelector.js";

export function tickSoundCounterAndStagePitch(m, count = m.regs.a, cell = m.regs.hl) {
  // Age the sound counter only while it is still running: on a nonzero count, write count-1 (wrapped to a
  // byte) back to loc_41c4. On a zero count the counter has already bottomed out, so leave it as-is --
  // the manager's ceiling logic upstream keeps it from wrapping back up.
  if (count !== 0) m.mem8[loc_41c4] = u8(count - 1);
  // Tail-call the pitch dispatcher on the same pointer: it keys on (cell)&3 to pick a fixed or a
  // counter-warbled pitch and parks the result in SOUND_PITCH (0x41c1).
  return stageSoundPitchBySelector(m, cell);
}
