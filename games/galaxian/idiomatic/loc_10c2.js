// SPDX-License-Identifier: GPL-3.0-only
// Per-object step keyed on the object record IX: bump the object's tick counter and count down its dwell
// timer; while the timer runs it returns. On expiry it queues a command word carrying the object's payload
// selector and advances the object's state.
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const OBJ_STATE = 2;     // dispatch state index
const OBJ_TICK = 4;      // free-running tick counter
const OBJ_SELECTOR = 7;  // payload selector byte
const OBJ_TIMER = 16;    // dwell countdown

const CMD_CHANNEL = 6;   // command-word channel
const PAYLOAD_BIAS = 75; // maps the selector into the command param

export function loc_10c2(m, obj = m.regs.ix) {
  const { mem8 } = m;

  mem8[obj + OBJ_TICK]++;
  mem8[obj + OBJ_TIMER] = mem8[obj + OBJ_TIMER] - 1; // store truncates: a 0 timer wraps to 255
  if (mem8[obj + OBJ_TIMER] !== 0) return; // timer still running

  const param = (mem8[obj + OBJ_SELECTOR] + PAYLOAD_BIAS) & 0xff;
  enqueueCommandWord(m, (CMD_CHANNEL << 8) | param);
  mem8[obj + OBJ_STATE]++;
}
