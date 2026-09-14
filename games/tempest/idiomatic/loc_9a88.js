// SPDX-License-Identifier: GPL-3.0-only
import { seatDemoCoordListPointer, loc_9aa9, loc_9ab3, seatCoordListPointerAtIndex3 } from "./seatDemoCoordListPointer.js";
import { selectClimberSpawnLane } from "./selectClimberSpawnLane.js";

// Computed jump: the incoming value selects one of five list-setup entries and runs it.
const TABLE = [seatDemoCoordListPointer, loc_9aa9, selectClimberSpawnLane, seatCoordListPointerAtIndex3, loc_9ab3];
export function loc_9a88(m, a = m.regs.a, x = m.regs.x) {
  return TABLE[a](m, x); // the slot rides in as an explicit arg the selected handler reads
}
