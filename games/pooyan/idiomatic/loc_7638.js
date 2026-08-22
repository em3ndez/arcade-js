// SPDX-License-Identifier: GPL-3.0-only
import { loc_7644 } from "./loc_7644.js";
import { loc_7675 } from "./loc_7675.js";
import { loc_76a6 } from "./loc_76a6.js";

const STATE_FIELD = 0x02; // state-byte offset within a record
const STATE_MASK = 0x03; //  low bits select the tick state

/**
 * loc_7638 — per-entry animation tick dispatcher (dissolved caller-skip propagator).
 *
 * Selects a tick-state handler by the low two bits of the entry's state byte (0/1/2) and tail-hands
 * to it. States 0 and 1 may abort the walk (returning false); state 2 always continues. The three
 * handlers are the only reachable states — the dispatch table has exactly three entries.
 *
 * LIVE-OUT: none in registers — returns the handler's control-flow boolean straight through (true =
 * keep walking, false = abort). Memory: whatever the selected handler wrote.
 */
export function loc_7638(m, ix = m.regs.ix) {
  const { mem8 } = m;

  switch (mem8[ix + STATE_FIELD] & STATE_MASK) {
    case 0:
      return loc_7644(m, ix);
    case 1:
      return loc_7675(m, ix);
    case 2:
      return loc_76a6(m, ix);
  }
}
