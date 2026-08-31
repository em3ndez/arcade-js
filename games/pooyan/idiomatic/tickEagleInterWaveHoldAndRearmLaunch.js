// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { WAVE_HOLD_TIMER, WAVE_INDEX, WAVE_LAUNCH_FLAG } from "./names.js";
/**
 * tickEagleInterWaveHoldAndRearmLaunch — the eagle bonus wave's idle handler.
 *
 * WHAT IT IS: the "resting" body of the eagle bonus-stage wave pipeline, ROM 0x73e3. The bonus
 * stage sends waves of eagles down at the player; between one wave dying out and the next being
 * seeded, the game inserts a deliberate breather. This routine is what runs during that breather.
 * It is reached once a wave has emptied out — the wave-launch driver hands control here when the
 * count of live eagle records has dropped to zero — and its whole job is to time the pause and
 * then unlock the next wave.
 *
 * ROLE IN THE MACHINE: the pause is measured by WAVE_HOLD_TIMER (0x8f36), a per-frame countdown
 * seeded when the wave's last record retired. This routine runs every frame while that timer is
 * counting: it ticks the timer down and does nothing else. Only when the timer finally hits zero
 * does it do the real work of the frame — announce the wave (so its sound/display fires), reseed
 * the hold so the same breather length applies next time, and drop the launch flag. Clearing the
 * launch flag is the hand-off: the wave-launch driver seeds a fresh wave only while
 * WAVE_LAUNCH_FLAG (0x8f3a) is clear, so zeroing it here is what re-arms the pipeline to build the
 * next wave.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: register A carries the routine's answer to its caller — on the ticking path it is the
 * pre-decrement hold value (non-zero, telling the caller "still holding, nothing to do"); on the
 * expiry path it is 0 ("hold elapsed, wave re-armed"). WAVE_HOLD_TIMER is left one lower (ticking)
 * or reseeded to 0x18 (expiry); on expiry WAVE_LAUNCH_FLAG is left 0.
 */
const HOLD_RESEED = 0x18;
const CMD_OPCODE = 0x06;
const CMD_PARAM_BASE = 0xb0;

export function tickEagleInterWaveHoldAndRearmLaunch(m) {
  const { mem8 } = m;

  // Sample the inter-wave hold countdown WAVE_HOLD_TIMER (0x8f36). While it is still non-zero the
  // breather between waves has not elapsed: spend this frame simply ticking it one closer to zero
  // and hand the (pre-decrement) value back in A, which reads non-zero and tells the caller the
  // hold is still running so no wave work should happen this frame. This is the common per-frame
  // path — most frames of the pause take exactly this branch and return.
  const hold = mem8[WAVE_HOLD_TIMER];
  if (hold !== 0) {
    mem8[WAVE_HOLD_TIMER] = hold - 1;
    return (m.regs.a = hold);
  }

  // The hold has reached zero: the breather is over. If a wave index WAVE_INDEX (0x8f3d) is still
  // set (a wave has been running), announce that wave by pushing a display command into the
  // command ring. The command word is class 0x06 (CMD_OPCODE) in its high byte with a low byte of
  // 0xb0 (CMD_PARAM_BASE) biased by the wave index — so each successive wave enqueues a distinct
  // 0x06b0+index command, which the ring consumer turns into that wave's sound/display effect. The
  // low byte is kept to eight bits since it is a single command argument.
  const waveIndex = mem8[WAVE_INDEX];
  if (waveIndex !== 0) {
    const param = (CMD_PARAM_BASE + waveIndex) & 0xff;
    enqueueDisplayCommand(m, (CMD_OPCODE << 8) | param);
  }

  // Rearm for the next cycle. Reseed WAVE_HOLD_TIMER (0x8f36) to 0x18 (HOLD_RESEED) so the same
  // breather length applies before the wave after next, and clear the launch flag WAVE_LAUNCH_FLAG
  // (0x8f3a) to 0. Zeroing the launch flag is the hand-off back to the wave-launch driver, which
  // seeds a fresh eagle wave only while that flag is clear. Return 0 in A to mark "hold elapsed,
  // pipeline re-armed".
  mem8[WAVE_HOLD_TIMER] = HOLD_RESEED;
  mem8[WAVE_LAUNCH_FLAG] = 0x00;
  return (m.regs.a = 0x00);
}
