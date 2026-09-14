// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotRimSegment } from "./drawSlotRimSegment.js";
import { drawStyledSlotRimSegment } from "./drawStyledSlotRimSegment.js";
import { emitJumpModeSlot } from "./emitJumpModeSlot.js";
import { emitAnimatedPhaseSlot } from "./emitAnimatedPhaseSlot.js";
import { emitInterpolatedSlotVector } from "./emitInterpolatedSlotVector.js";

// Computed dispatch: the caller passes A as a byte offset (0,2,4,6,8) into a 2-byte-per-entry
// table; select the draw handler and tail-return its result to this routine's own caller.
const TABLE = [drawSlotRimSegment, drawStyledSlotRimSegment, emitJumpModeSlot, emitAnimatedPhaseSlot, emitInterpolatedSlotVector];

export function dispatchSlotDrawHandler(m, a = m.regs.a, x = m.regs.x) {
  return TABLE[a >> 1](m, x);
}
