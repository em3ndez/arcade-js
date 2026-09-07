// SPDX-License-Identifier: GPL-3.0-only
//
// broadcastToStridedTable (ROM 0x0972) -- [seen]
//
// WHAT IT IS
//   The shared block-writer that copies one byte into every cell of a nine-entry, stride-2 table
//   based at loc_4028 (0x4028, 0x402a, 0x402c, ... 0x4038). It is the low-level primitive the
//   formation code and the per-state reset both lean on; callers pass the value already computed.
//
// ROLE IN THE MACHINE
//   0x4028 is the EVEN lane of the object-RAM shadow (0x4020..0x405f), the interleaved region the
//   vblank service pushes wholesale to the sprite/scroll/bullet hardware each frame. This even lane
//   holds the swept horizontal column coordinate shared by the standing formation, so writing all
//   nine cells at once is how a single sway value reaches every column on the hardware side.
//   Callers: broadcastNegatedSweepToStridedTable / ...FormationSweep... (the sway) publish the
//   negated anchor low byte here; clearStridedTable (0x0363) broadcasts 0 here to wipe the lane at
//   sequence-state transitions.
//
// LIVE-OUT: mem8[0x4028 + 2i] for i in 0..8 all set to `value`.
import { loc_4028 } from "./names.js";

// Nine cells at stride 2: the coordinate lane skips its interleaved neighbour (the odd sprite-code
// lane) so each successive write lands two bytes further on.
const CELL_COUNT = 9;
const STRIDE = 2;

export function broadcastToStridedTable(m, value = m.regs.a) {
  const { mem8 } = m;

  // Fan the single byte across all nine coordinate cells of the object-shadow even lane.
  for (let i = 0; i < CELL_COUNT; i++) mem8[loc_4028 + i * STRIDE] = value;
}
