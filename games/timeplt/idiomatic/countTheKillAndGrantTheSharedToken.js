// SPDX-License-Identifier: GPL-3.0-only
/** countTheKillAndGrantTheSharedToken — the frame an object begins dying: request the death sounds,
 * floor-decrement the kill count, then (while the wave claim window is open and the object's cooldown
 * top bit is set) tick WAVE_KILL_COUNTDOWN down — the tick that zeroes it writes this object's ordinal
 * (top bit set) into CLAIM_TOKEN, the shared one-shot claim. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { requestTwoSounds } from "./requestTwoSounds.js";
import { CLAIM_TOKEN, KILLS_REMAINING, WAVE_CLAIM_TIMER, WAVE_KILL_COUNTDOWN } from "./names.js";

const COOLDOWN = 0x0e;
const ORDINAL = 0x0f;
const COOLDOWN_CLAIMS = 0x80;
const HOLDER_MARK = 0x80;

export function countTheKillAndGrantTheSharedToken(m, object = m.regs.ix) {
  const { mem8 } = m;
  requestTwoSounds(m);

  if (mem8[KILLS_REMAINING] !== 0) mem8[KILLS_REMAINING] = mem8[KILLS_REMAINING] - 1;

  if ((mem8[object + COOLDOWN] & COOLDOWN_CLAIMS) === 0) return;
  if (mem8[WAVE_CLAIM_TIMER] === 0) return;

  mem8[WAVE_KILL_COUNTDOWN] = u8(mem8[WAVE_KILL_COUNTDOWN] - 1);
  if (mem8[WAVE_KILL_COUNTDOWN] !== 0) return;

  mem8[CLAIM_TOKEN] = u8(mem8[object + ORDINAL] + HOLDER_MARK);
}
