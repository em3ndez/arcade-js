// SPDX-License-Identifier: GPL-3.0-only
//
// advanceSoundSweepAndStagePitch (ROM 0x17e5, [seen]) -- the sound-counter manager head.
//
// WHAT IT IS
//   The shared machinery that turns the sweep voice's counter state into a staged pitch. It is entered
//   from updateSoundSweepVoice (ROM 0x17d0) on frames where the sweep is still running, and it is the
//   head of a small fall-through chain that ends by staging SOUND_PITCH (0x41c1) via the pitch-selector
//   dispatcher. (mechanisms.md, "The sweep voice".)
//
// ROLE IN THE MACHINE
//   loc_4226 bit0 is a gate: while set, the sweep is frozen and the routine bails early. Otherwise it
//   steps its working pointer forward one cell (to the sweep cell loc_41c3) and branches on frame
//   parity via FRAME_COUNTER (0x425f): on odd frames (bit0 set) it hands straight to the pitch-selector
//   dispatcher stageSoundPitchBySelector, staging pitch without bumping the sweep. On even frames it
//   first bumps the pointed sweep cell -- but only while the sound counter loc_41c4 sits below its
//   ceiling of 96 -- then falls into the counter tick tickSoundCounterAndStagePitch, which decrements
//   the counter if it is still running and then also dispatches the pitch selector.
//
// LIVE-OUT: the pointed sweep cell (loc_41c3) and, through the delegates, loc_41c4 and SOUND_PITCH.
import { u16 } from "../../../core/int.js";
import { loc_4226, FRAME_COUNTER, loc_41c4 } from "./names.js";
import { stageSoundPitchBySelector } from "./stageSoundPitchBySelector.js";
import { tickSoundCounterAndStagePitch } from "./tickSoundCounterAndStagePitch.js";

const COUNTER_CEILING = 96; // the pointed cell is bumped only while the sound counter stays below this

export function advanceSoundSweepAndStagePitch(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  // Gate loc_4226 bit0 set: the sweep is frozen this frame, so do nothing.
  if (mem8[loc_4226] & 1) return;
  // Step the working pointer forward one cell (onto the sweep cell loc_41c3). u16 keeps the Z80 16-bit
  // wrap.
  ptr = u16(ptr + 1);
  // Odd frame (FRAME_COUNTER bit0 set): skip the bump and hand straight to the pitch-selector dispatcher.
  if (mem8[FRAME_COUNTER] & 1) return stageSoundPitchBySelector(m, ptr);

  // Even frame: read the sound counter; bump the pointed sweep cell only while the counter is below its
  // ceiling of 96 (past the ceiling the sweep stops advancing until it decays).
  const count = mem8[loc_41c4];
  if (count < COUNTER_CEILING) mem8[ptr] = mem8[ptr] + 1;
  // Fall into the counter tick, which decrements loc_41c4 if still running and dispatches the pitch.
  return tickSoundCounterAndStagePitch(m, count, ptr);
}
