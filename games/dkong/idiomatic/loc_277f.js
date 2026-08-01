// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_277f — the edge reset reached when the vertical mover runs off its track.
 * ROM 0x277F.
 *
 * The vertical move routines (0x276F down, 0x2787 up) tail into here the moment
 * the moving object's position leaves its legal range. It unconditionally clears
 * two cells and returns: MARIO_ACTIVE goes to 0 (the mover is switched off) and
 * the edge/reposition flag at 0x6398 is cleared. There are no inputs, no branches
 * and no callees — it always writes the same two zeros.
 *
 * NAME: kept the neutral loc_. The mechanism is exact against the oracle, but the
 * meaning of the 0x6398 flag (set to 1 by the vertical-reposition path at 0x29AF,
 * cleared here and by the sibling reset at 0x2766) is not confirmed to the
 * routine-name bar, so the purpose stays open. Promote once corroborated.
 *
 * A LEAF: writes MARIO_ACTIVE and the edge flag; calls nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-277f.test.js.
 * GATE:     exhaustive over the only thing that can vary — the prior contents of the
 *           two written cells (and noise in neighbours) — since the routine takes no
 *           input and always writes the same zeros; plus real captured 0x277F
 *           dispatches when attract reaches an edge reset, else crafted entries that
 *           drive it. RAM diff is the whole dump (the oracle writes no stack — its
 *           terminal return only pops), so no STACK_SCRATCH exclusion is needed.
 * LIVE-OUT: memory-only (MARIO_ACTIVE, edge flag 0x6398). The oracle's cleared
 *           accumulator/flags and its terminal return are dead ABI — the per-frame
 *           mover chain that tail-calls this discards them.
 * NAMES:    MARIO_ACTIVE (0x6200) from ram.js. The edge flag 0x6398 has no ram.js
 *           name yet (a movement/reposition state flag), so it stays a local hex const.
 */

import { MARIO_ACTIVE } from "./ram.js";

// Movement/edge state flag: set to 1 by the vertical-reposition path (0x29AF) and
// cleared by the edge-reset routines (here and 0x2766). No ram.js name yet.
const EDGE_FLAG = 0x6398;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function loc_277f(m) {
  const { mem } = m;

  // Switch the mover off and clear its edge flag.
  mem.write8(MARIO_ACTIVE, 0);
  mem.write8(EDGE_FLAG, 0);
}
