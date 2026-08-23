// SPDX-License-Identifier: GPL-3.0-only
import { loc_60f2 } from "./loc_60f2.js";
import { loc_61b4 } from "./loc_61b4.js";
import { loc_6080 } from "./loc_6080.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * loc_6069 — scan head: classify the current record and route it.
 *
 * A record with a zero lead byte, or whose kind byte is not the live kind, is skipped to the
 * epilogue. Otherwise an odd round routes to the collision handler and an even round to the
 * proximity gate.
 *
 * LIVE-OUT: a boolean forwarded from the route taken — true = normal completion,
 * false = a caller-skip must unwind the caller's frame.
 */
const LIVE_KIND = 0x05;
const KIND_OFFSET = 0x02;

export function loc_6069(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;
  if (mem8[hl] === 0) return loc_60f2(m, hl, ix, count); // empty record
  const kind = mem8[(hl & ~0xff) | ((hl + KIND_OFFSET) & 0xff)];
  if (kind !== LIVE_KIND) return loc_60f2(m, hl, ix, count);
  if (mem8[ROUND_COUNTER] & 0x01) return loc_61b4(m, hl, ix, count); // odd round
  return loc_6080(m, hl, ix, count);
}
