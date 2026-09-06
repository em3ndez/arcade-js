// SPDX-License-Identifier: GPL-3.0-only
// Object-slot scan head. Read the low nibble of the frame/slot counter: when it is zero there are no active
// slots, so repaint the player-status column. Otherwise index the object grid by that nibble and, unless the
// flags byte's bit 0 gate is set, seed a six-slot scan (stride 0x10) and hand off to the per-slot worker.
import { loc_425f, loc_4238, OBJECT_GRID_BASE } from "./names.js";
import { repaintPlayerStatusColumnFromModeGate } from "./repaintPlayerStatusColumnFromModeGate.js";
import { loc_207d } from "./loc_207d.js";

const SLOT_STRIDE = 0x10; // per-slot stride the worker loop advances the grid pointer by (C)
const SLOT_COUNT = 6;     // number of slots the worker loop scans (B)

export function loc_2067(m) {
  const { mem8 } = m;

  const nibble = mem8[loc_425f] & 0x0f; // low nibble = active-slot count
  if (nibble === 0) return repaintPlayerStatusColumnFromModeGate(m); // no active slots

  // grid base + nibble; the add only touches the low byte and cannot carry here (nibble <= 15,
  // base low byte 0x20), so the sum is exact.
  const ptr = OBJECT_GRID_BASE + nibble;

  if (mem8[loc_4238] & 0x01) return; // flags bit 0 set -> nothing to do

  // Fall into the per-slot worker with the loop registers seeded (grid pointer, stride, count).
  return loc_207d(m, (SLOT_COUNT << 8) | SLOT_STRIDE, ptr); // BC = count<<8|stride, HL = grid pointer (207d ABI)
}
