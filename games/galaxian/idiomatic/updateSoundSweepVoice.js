// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateSoundSweepVoice (ROM 0x17d0) -- the pitch-sweep voice of the per-frame sound driver.
 *
 * WHAT IT IS
 *   One of the voice updaters the sound driver runs in a fixed order each frame (it is the second of
 *   them). It produces a falling/rising pitch sweep by running a countdown and, while that countdown
 *   is alive, delegating the actual sweep-and-pitch work to the sound-counter manager; when the
 *   countdown finally expires it re-arms an idle template so the sweep goes quiet until re-triggered.
 *
 * ROLE IN THE MACHINE
 *   Called from driveSoundFrame's channel/effect loop. Like the rest of the driver it only acts while
 *   the sound driver is enabled -- bit 0 of loc_4006 (0x4006). Its countdown lives in loc_41c2 (0x41c2)
 *   with the sweep cell one byte above it (0x41c3) and the sound counter at loc_41c4 (0x41c4). While the
 *   countdown minus one is still nonzero it hands loc_41c2 to advanceSoundSweepAndStagePitch (0x17e5),
 *   which steps the sweep cell (while loc_41c4 sits below its 96 ceiling) and stages SOUND_PITCH
 *   (0x41c1). On the tick the countdown reaches zero it reloads the idle template instead.
 *
 * Grounding: [code]. Its own writes are only the constant idle-template reload, which grounds no cell;
 * the sweep/pitch production is delegated to [code] routines, so this routine stays [code]
 * (see mechanisms.md "The sweep voice"; names.js role for 0x17d0).
 *
 * LIVE-OUT: SOUND_PITCH (0x41c1) staged via the delegate on live frames; on expiry loc_41c2/0x41c3/loc_41c4
 * reset to the idle template.
 */
import { u8 } from "../../../core/int.js";
import { loc_4006, loc_41c2, loc_41c4 } from "./names.js";
import { advanceSoundSweepAndStagePitch } from "./advanceSoundSweepAndStagePitch.js";

const SWEEP_IDLE = 2;     // low byte of the idle template -> the sweep cell (counter + 1)
const COUNTER_IDLE = 160; // high byte of the idle template -> the sound counter (parked past its ceiling)

export function updateSoundSweepVoice(m) {
  const { mem8 } = m;

  // Driver-enable gate: the whole sound driver is switched by bit 0 of loc_4006. With it clear the
  // sweep voice does nothing this frame -- bail before touching any sound cell.
  if ((mem8[loc_4006] & 1) === 0) return;

  // Peek the countdown one tick ahead (loc_41c2 - 1, wrapped to a byte). This decides which branch runs
  // but does not itself commit the decrement -- the delegate owns the running-state bookkeeping.
  const next = u8(mem8[loc_41c2] - 1);
  // Still running: hand the countdown cell to the sound-counter manager, which steps the sweep cell
  // (0x41c3) while loc_41c4 < 96 and stages the resulting pitch into SOUND_PITCH (0x41c1).
  if (next !== 0) return advanceSoundSweepAndStagePitch(m, loc_41c2);

  // Countdown expired: reload the idle template so the sweep parks until it is re-triggered.
  // Zero the countdown itself,
  mem8[loc_41c2] = 0;
  // set the sweep cell one byte above it to the idle low byte (2),
  mem8[loc_41c2 + 1] = SWEEP_IDLE;
  // and park the sound counter at 160 -- deliberately past the 96 working ceiling, so the manager stops
  // bumping the sweep cell until the counter decays back under the ceiling on a future re-trigger.
  mem8[loc_41c4] = COUNTER_IDLE;
}
