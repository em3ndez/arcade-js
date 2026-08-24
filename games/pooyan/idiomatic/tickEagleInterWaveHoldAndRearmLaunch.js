// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import { WAVE_HOLD_TIMER, WAVE_INDEX, WAVE_LAUNCH_FLAG } from "./names.js";
/**
 * tickEagleInterWaveHoldAndRearmLaunch — eagle inter-wave idle handler.
 *
 * While the hold timer is non-zero, tick it down and return the pre-decrement value. On expiry,
 * if a wave index is still set, enqueue a command carrying that index; then reseed the hold timer
 * and clear the launch flag.
 * LIVE-OUT: A — the pre-decrement hold value on the ticking path, else 0 (callers read it back).
 */
const HOLD_RESEED = 0x18;
const CMD_OPCODE = 0x06;
const CMD_PARAM_BASE = 0xb0;

export function tickEagleInterWaveHoldAndRearmLaunch(m) {
  const { mem8 } = m;

  const hold = mem8[WAVE_HOLD_TIMER];
  if (hold !== 0) {
    mem8[WAVE_HOLD_TIMER] = hold - 1;
    return (m.regs.a = hold);
  }

  const waveIndex = mem8[WAVE_INDEX];
  if (waveIndex !== 0) {
    const param = (CMD_PARAM_BASE + waveIndex) & 0xff;
    loc_0038(m, (CMD_OPCODE << 8) | param);
  }
  mem8[WAVE_HOLD_TIMER] = HOLD_RESEED;
  mem8[WAVE_LAUNCH_FLAG] = 0x00;
  return (m.regs.a = 0x00);
}
