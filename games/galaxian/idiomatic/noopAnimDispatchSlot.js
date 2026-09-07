// SPDX-License-Identifier: GPL-3.0-only
// noopAnimDispatchSlot -- ROM 0x1146, grounding [seen].
// The do-nothing terminal slot (sub-state 3) of the deactivated/dying-object
// animation dispatch table. dispatchDeactivatedObjectAnim (ROM 0x10e4) reads an
// object record's sub-state field (ix+2) and tail-dispatches through an rst-28
// jump table to the matching phase handler; slot 3 needs a valid target that
// simply does nothing, so a dying object can rest in its final animation
// sub-state without any side effect. This is that target: a pure no-op.
// Takes no machine argument and touches no registers or memory.
export function noopAnimDispatchSlot() {
  // No-op: the animation is parked in its terminal sub-state; nothing to do.
}
