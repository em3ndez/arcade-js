// SPDX-License-Identifier: GPL-3.0-only
import { seatDemoCoordListPointer, loc_9aa9, loc_9ab3, seatCoordListPointerAtIndex3 } from "./seatDemoCoordListPointer.js";
import { selectClimberSpawnLane } from "./selectClimberSpawnLane.js";

// The five list-setup entries in dispatch order (0..4), matching ROM targets 0x9a9d, 0x9aa9, 0x9abb,
// 0x9ab7, 0x9ab3. Each front-loads a specific coordinate-list index/low-byte then falls into the
// shared seating tail at 0x9aee/0x9af1.
const TABLE = [seatDemoCoordListPointer, loc_9aa9, selectClimberSpawnLane, seatCoordListPointerAtIndex3, loc_9ab3];
/**
 * dispatchCoordListSetup — computed jump into the coordinate-list setup entries. ROM 0x9a88.
 *
 * Role in the machine: enemies in the tube draw from packed coordinate/shape lists, and different
 * enemy kinds need their list pointer seated differently (demo path, climber spawn lane, a fixed
 * index, etc.). This routine is the original 6502 jump-table dispatcher: the selector value in A
 * picks one of five setup handlers and runs it, while the enemy slot index in X rides through to the
 * chosen handler. It is reached from setupEnemyCoordList (ROM 0x9b07) for held counts >= 0x20 and
 * from dispatchListSetupByColumn (ROM 0x9a87).
 *
 * Behavior: index TABLE by the selector A (0..4) and tail-call the selected handler with (m, x). The
 * dispatcher itself keeps no state — it is a direct translation of the ROM's computed jump — and
 * relays whatever the chosen handler returns back to the caller.
 *
 * Live-out: none of its own; whatever the selected setup handler seats (the coordinate-list pointer
 * pair for slot x) plus that handler's return value, relayed. Grounding: seen.
 */
export function dispatchCoordListSetup(m, a = m.regs.a, x = m.regs.x) {
  return TABLE[a](m, x); // the slot index rides in as an explicit arg the selected handler reads
}
