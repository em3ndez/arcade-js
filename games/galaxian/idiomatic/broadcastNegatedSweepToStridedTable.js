// SPDX-License-Identifier: GPL-3.0-only
//
// broadcastNegatedSweepToStridedTable (ROM 0x096f) -- [seen]
//
// WHAT IT IS
//   Compute the two's-complement (negation) of the formation-sweep low byte and hand it to the
//   shared block writer, which broadcasts it across the nine-cell stride-2 work-RAM table at
//   0x4028 (0x4028, 0x402a, ... 0x4038).
//
// ROLE IN THE MACHINE
//   The formation anchor advances as a positive 16-bit word (loc_420e), but the hardware column
//   coordinate is stored negated -- the sprite/scroll lane wants the complement of the anchor's low
//   byte. The 8080/Z80 source negates L (the anchor low byte) here before publishing, so the whole
//   formation slides as one. Called from the sway (advanceFormationSweepOscillator) after each step;
//   the default arg mirrors the register calling convention (L holds the swept low byte).
//
// LIVE-OUT: the nine coordinate cells at 0x4028 (stride 2), each set to (-low) & 0xff.
import { broadcastToStridedTable as loc_0972 } from "./broadcastToStridedTable.js";

// Negate the low byte to the hardware's stored-complement form, then fan it across the strided lane.
export function broadcastNegatedSweepToStridedTable(m, low = m.regs.l) {
  return loc_0972(m, (-low) & 0xff);
}
