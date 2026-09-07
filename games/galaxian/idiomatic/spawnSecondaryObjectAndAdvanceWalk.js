// SPDX-License-Identifier: GPL-3.0-only
//
// spawnSecondaryObjectAndAdvanceWalk -- ROM 0x148e. Grounding: [seen].
//
// WHAT IT IS
//   The per-slot step of the secondary-object spawn walk. It spawns one secondary into the current slot,
//   advances the slot pointer to the next record, and counts the caller's remaining budget down by one.
//   Called from the trigger-block spawners (spawnPrimaryAndSecondaryObjects / spawnObjectsFromTriggerFlags)
//   as the body of their "for each set flag, up to N secondaries" loop.
//
// ROLE IN THE MACHINE
//   Objects live in an eight-slot array of 32-byte records; secondaries occupy the records just past the
//   primary. The actual activation (guard-flag check, alive mark, field-6 inherit, activation command
//   word) is delegated to spawnSecondaryObjectIntoSlot (0x149b); this routine only owns the loop plumbing.
//   The Z80 kept the slot pointer in IY, the budget in C, and the enclosing walk counter in B, which is
//   why the register mirrors below are IY/C/B.
//
// LIVE-OUT
//   m.regs.iy = the next slot record (IY + 32); m.regs.c = the decremented budget. When the budget hits
//   zero it also sets m.regs.b = 1, forcing the caller's B loop counter so the enclosing walk ends after
//   this pass. Plus whatever spawnSecondaryObjectIntoSlot writes into the slot / command queue.
import { u8, u16 } from "../../../core/int.js";
import { spawnSecondaryObjectIntoSlot } from "./spawnSecondaryObjectIntoSlot.js";

const SLOT_STRIDE = 32; // bytes between consecutive secondary slots

export function spawnSecondaryObjectAndAdvanceWalk(m, slot = m.regs.iy, budget = m.regs.c) {
  // Spawn into the current slot; the callee no-ops if the slot's guard flags say it is already live.
  spawnSecondaryObjectIntoSlot(m, slot);

  // Advance the slot pointer one record and spend one unit of budget (both wrapped to their Z80 widths:
  // IY is 16-bit, C is 8-bit).
  const nextSlot = u16(slot + SLOT_STRIDE);
  const nextBudget = u8(budget - 1);

  // Budget still remaining: publish the stepped slot/budget and let the caller's own counter run the walk.
  if (nextBudget !== 0) return (m.regs.iy = nextSlot, m.regs.c = nextBudget);
  // Budget spent: also stamp B = 1 so the caller's loop counter expires and the walk ends after this pass.
  return (m.regs.iy = nextSlot, m.regs.c = nextBudget, m.regs.b = 1);
}
