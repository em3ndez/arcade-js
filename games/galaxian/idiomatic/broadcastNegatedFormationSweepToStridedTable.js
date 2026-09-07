// SPDX-License-Identifier: GPL-3.0-only
//
// broadcastNegatedFormationSweepToStridedTable (ROM 0x0988) -- [seen]
//
// WHAT IT IS
//   Load the swept formation word's low byte from loc_420e and tail-jump into
//   broadcastNegatedSweepToStridedTable (0x096f), which stores -(low byte) across the nine-cell
//   stride-2 work-RAM table (0x4028, 0x402a, ... 0x4038).
//
// ROLE IN THE MACHINE
//   This is the "re-publish without stepping" entry into the sway. The main oscillator
//   (advanceFormationSweepOscillator) normally advances loc_420e and then broadcasts the new value;
//   but its leading proximity gate -- player's shot armed and lined up on the currently-named,
//   occupied column -- short-circuits straight here, re-emitting the CURRENT anchor so the block does
//   not slide the target column out from under an incoming shot on that frame. loc_420e is the
//   formation anchor (a 16-bit word); only its low byte drives the horizontal column coordinate.
//
// LIVE-OUT: the nine coordinate cells at 0x4028 (stride 2), each set to (-mem8[0x420e]) & 0xff.
import { broadcastNegatedSweepToStridedTable } from "./broadcastNegatedSweepToStridedTable.js";
import { loc_420e } from "./names.js";

// Read the live anchor low byte and re-broadcast its negation, leaving the anchor itself untouched.
export function broadcastNegatedFormationSweepToStridedTable(m) {
  return broadcastNegatedSweepToStridedTable(m, m.mem8[loc_420e]);
}
