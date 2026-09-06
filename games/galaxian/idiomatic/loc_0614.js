// SPDX-License-Identifier: GPL-3.0-only
// State-timer handler: tick the state timer; while it still runs, done. On expiry reload the timer,
// advance the sequence step, seed the active flag and reference X, refill the sub-counter block from
// its reload table, clear two scratch cells, and queue two command words.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4009,
  SEQUENCE_STATE,
  OBJ_ACTIVE_FLAG,
  loc_4202,
  SUBCOUNTER_RELOAD_TABLE,
  loc_424a,
  loc_4058,
  loc_405a,
} from "./names.js";

const TIMER_RELOAD = 10;
const SUBCOUNTER_BYTES = 16;

export function loc_0614(m) {
  const { mem8, mem16 } = m;

  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return; // still counting down

  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE]++;

  mem16[OBJ_ACTIVE_FLAG] = 1;
  mem8[loc_4202] = 128;
  for (let i = 0; i < SUBCOUNTER_BYTES; i++) mem8[loc_424a + i] = mem8[SUBCOUNTER_RELOAD_TABLE + i];
  mem8[loc_4058] = 0;
  mem8[loc_405a] = 0;

  enqueueCommandWord(m, (7 << 8) | 3);
  return enqueueCommandWord(m, 2 << 8);
}
