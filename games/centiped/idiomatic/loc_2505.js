// SPDX-License-Identifier: GPL-3.0-only
import { rebuildSegmentSpriteTables } from "./rebuildSegmentSpriteTables.js";

/**
 * loc_2505 — a thin forwarding entry (ROM 0x2505) that jumps straight into the segment sprite-table
 * rebuild and returns whatever that returns. It carries no state of its own, sets up no registers, and
 * branches nowhere: it is a pure tail call.
 *
 * Why it exists as its own labelled routine at all: the death/respawn dispatcher
 * (advanceDeathRespawnSequence) needs "rebuild the segment sprite tables" to be reachable as a named
 * jump target — it forwards here whenever `$43 & 0xaf` is clear — so the one-liner is a real entry
 * point in the ROM, not dead code.
 *
 * Role: round-lifecycle / thin forward into the segment-sprite rebuild.  Grounding: [code].
 * Live-out: the rebuild's own result (no own writes).
 */
export function loc_2505(m) {
  // Tail-call the rebuild; its return value is this routine's return value.
  return rebuildSegmentSpriteTables(m);
}
