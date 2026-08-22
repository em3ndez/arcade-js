// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { loc_3553 } from "./loc_3553.js";
/**
 * loc_416f — per-object dwell-then-dispatch step for the record based at IX. First it advances the
 * object's animation; field +0x11 is a dwell countdown: while it stays non-zero the object holds
 * and the routine returns. On expiry it tails into the next-state handler, which blanks the band.
 * LIVE-OUT: none — a table-dispatched step; the whole result is in the record's memory.
 */
const DWELL_FIELD = 0x11; // frame dwell countdown

export function loc_416f(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // advance the object's animation

  mem8[rec + DWELL_FIELD] = mem8[rec + DWELL_FIELD] - 1;
  if (mem8[rec + DWELL_FIELD] !== 0) return; // still dwelling this frame

  return loc_3553(m, rec); // dwell elapsed: tail into the next-state band blank
}
