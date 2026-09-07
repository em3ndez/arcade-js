// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectPathStepAlias -- object-AI dispatch slot 11: a bare trampoline, no work of its own.
 *
 * WHAT IT IS
 *   Slot 11 of the sixteen-entry object-AI state table (the driveObjectSlot dispatch table at ROM 0x0ce6,
 *   its own entry point at ROM 0x0cfc). In the original Z80 it is a single JP into the slot-1 handler, so
 *   this JS mirror forwards unchanged to advanceObjectPathStep (ROM 0x0d71, the shared per-object
 *   path-walk step). Two state indices thus run the exact same path-walk body.
 *
 * ROLE IN THE MACHINE
 *   It performs no computation and holds no state of its own -- it exists only so state index 11 reuses
 *   the state-1 path-move handler. All object-record side effects happen inside advanceObjectPathStep,
 *   which reads the currently selected object from m.regs.ix.
 *
 * ROM 0x108e.  Grounding: [seen] (confirmed trampoline into 0x0d71).
 *
 * LIVE-OUT: whatever advanceObjectPathStep writes (the selected object's path-walk cells); none here.
 */
import { advanceObjectPathStep } from "./advanceObjectPathStep.js";

export function advanceObjectPathStepAlias(m) {
  // Forward straight to the shared path-walk step for the object currently selected (m.regs.ix).
  return advanceObjectPathStep(m);
}
