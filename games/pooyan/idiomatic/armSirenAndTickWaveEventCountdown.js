// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommands96And97And18And15 } from "./queueSoundCommands96And97And18And15.js";
import { queueSoundCommands19And15 } from "./queueSoundCommands19And15.js";
import { queueSirenSoundRun } from "./queueSirenSoundRun.js";
import {
  PERIODIC_MODE_LATCH,
  SPAWN_PHASE_COUNTER,
  GRAB_ACTIVE_FLAG,
  SIREN_ENABLE_GATE,
  WAVE_EVENT_LATCH,
  WAVE_TEARDOWN_STATE,
  PERIODIC_EVENT_TIMER,
} from "./names.js";
/**
 * armSirenAndTickWaveEventCountdown — gated periodic driver for the warning-siren arm
 * and the shared wave-event countdown.
 *
 * WHAT IT IS: one of the small per-frame housekeeping routines the main loop runs while a
 * round is in progress. Behind a single busy gate it does two jobs. First it reads the
 * per-round phase/step counter and, on the two phase values that matter, arms the warning
 * siren and queues its sound. Then, on the way out for every mode, it ages a countdown
 * that periodically re-fires the siren for the length of the wave.
 *
 * ROLE IN THE MACHINE: this is the scheduler that decides WHEN the warning siren sounds —
 * both the one-shot arm as an attack phase begins and the repeating re-arm every 0x20
 * frames until the wave is torn down. It is the producer of the one-shot latches other
 * subsystems consume: the siren-enable gate the idle-siren ticker watches, and the
 * wave-event latch the siren-tile path and the wave teardown read.
 *
 * The behaviour splits three ways on SPAWN_PHASE_COUNTER: below five does nothing here and
 * falls straight to the shared countdown tail; exactly five arms a two-cell siren pair and
 * fires the phase-five sound; above five records the value in the busy latch (claiming the
 * driver for the rest of the round) and fires the higher-phase sound. The shared tail then
 * returns early if the wave event has already latched or the wave is tearing down;
 * otherwise it runs the periodic countdown that, on expiry, reloads, latches the wave
 * event, and fires the siren-tile run.
 *
 * ROM 0x196e-0x19bb.
 * Grounding: [seen].
 *
 * LIVE-OUT: memory only. It leaves state in PERIODIC_MODE_LATCH, the siren pair
 * (SIREN_ENABLE_GATE / SIREN_FRAME_COUNTDOWN), WAVE_EVENT_LATCH and PERIODIC_EVENT_TIMER,
 * plus queued sound commands. The caller runs it as one of a sequence and reads nothing back.
 */

const TIMER_RELOAD = 0x20; // event-countdown reload value

// `hl` is the pointer the caller left in HL: the alternate siren-pair base used only while
// a rope-grab is in progress (see the phase-five branch below).
export function armSirenAndTickWaveEventCountdown(m, hl = m.regs.hl) {
  const { mem8 } = m;

  // Busy gate. PERIODIC_MODE_LATCH (0x8d55) is set nonzero only once a higher spawn phase
  // has already claimed this driver for the remainder of the round. While it is set the
  // whole routine is a no-op, so neither the mode branch nor the countdown tail can run
  // again this round.
  if (mem8[PERIODIC_MODE_LATCH] !== 0) return; // driver busy

  // SPAWN_PHASE_COUNTER (0x8902) is the per-round phase/step counter (it cycles up to 7).
  // Its value selects the siren action for this frame.
  const mode = mem8[SPAWN_PHASE_COUNTER];
  if (mode === 0x05) {
    // Phase five: arm a two-cell siren pair. With no rope-grab in progress
    // (GRAB_ACTIVE_FLAG / 0x8d32 clear) the pair is anchored at the warning-siren enable
    // gate SIREN_ENABLE_GATE (0x8d68). While a grab is running the arm is redirected to the
    // caller-supplied pointer in HL so it leaves the real siren cells untouched.
    let pair = mem8[GRAB_ACTIVE_FLAG] === 0 ? SIREN_ENABLE_GATE : hl;
    // Arm only while the first cell is still clear, so the pair is armed once as the phase
    // opens rather than re-armed on every frame it stays in phase five.
    if (mem8[pair] === 0) { // first cell free -> arm the pair and fire the run
      // Set the enable gate. Once SIREN_ENABLE_GATE is nonzero the idle-siren ticker
      // (tickIdleSirenAndTogglePhase) starts toggling the siren phase byte each frame.
      mem8[pair] = 0x01;
      // Advance to the second cell of the pair, SIREN_FRAME_COUNTDOWN (0x8d6a): hold the
      // 0x8d page fixed and step the low byte by two with 8-bit wrap, then arm it too.
      pair = (pair - (pair & 0xff)) + ((pair + 2) & 0xff); // keep the page, step the low byte by two
      mem8[pair] = 0x01;
      // Queue the phase-five siren sound: 0x96,0x97 into the sound-command ring and
      // 0x18,0x15 into the sound ring.
      queueSoundCommands96And97And18And15(m);
    }
  } else if (mode > 0x05) {
    // Phase above five: claim the driver for the rest of the round by recording the phase
    // value in PERIODIC_MODE_LATCH (0x8d55); the busy gate at the top then short-circuits
    // every later call this round.
    mem8[PERIODIC_MODE_LATCH] = mode; // latch the mode
    // Fire the higher-phase sound run (command 0x19 then 0x15) unless a rope-grab is in
    // progress, which suppresses it.
    if (mem8[GRAB_ACTIVE_FLAG] === 0) queueSoundCommands19And15(m);
  }

  // Shared countdown tail, reached for every mode (including below five). Skip it entirely
  // while the wave event has already latched (WAVE_EVENT_LATCH / 0x8d21 set) or the wave is
  // being torn down (WAVE_TEARDOWN_STATE / 0x8f24 set): once the wave has signalled or is
  // ending, the periodic re-fire is suppressed.
  if (mem8[WAVE_EVENT_LATCH] !== 0) return;
  if (mem8[WAVE_TEARDOWN_STATE] !== 0) return;

  // PERIODIC_EVENT_TIMER (0x8d22) is the free-running siren re-arm countdown.
  if (mem8[PERIODIC_EVENT_TIMER] === 0) { // expired -> reload, latch, draw
    // Expired this frame: reload it to 0x20 frames for the next cycle, raise the one-shot
    // WAVE_EVENT_LATCH (0x8d21) that other subsystems consume (it is cleared again on wave
    // teardown), and fire the siren-tile run — the round-selected siren lead byte plus the
    // completing sound-command run, gated on the siren enable state.
    mem8[PERIODIC_EVENT_TIMER] = TIMER_RELOAD;
    mem8[WAVE_EVENT_LATCH] = 0x01;
    queueSirenSoundRun(m);
    return;
  }
  // Not expired: age the countdown one frame toward the next re-fire.
  mem8[PERIODIC_EVENT_TIMER] = (mem8[PERIODIC_EVENT_TIMER] - 1); // tick down
}
