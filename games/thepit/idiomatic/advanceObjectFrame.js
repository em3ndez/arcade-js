// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectFrame — pick the tracked object's per-frame update from its mode and move command.  ROM 0x1434.
 *
 * Runs once per frame for the object being processed. The object's mode byte decides the
 * broad case, its move command the fine one:
 *
 *   - Mode clear (the object is at rest this frame): hand the move command to the at-rest
 *     router, which positions or animates the object, or stands it still.
 *   - Mode set (the object is in motion): run one of two walk steppers. The move command's
 *     first direction bit selects the walk step measured against a moving reference; its
 *     second direction bit selects the momentum walk step; with neither bit set, the sign
 *     of the mode byte chooses between the two.
 *
 * The move command is the attract demo's steering byte during the demo, or the debounced
 * joystick otherwise — the same byte the at-rest router consumes. It arrives in a register
 * from the still-oracle caller, so reading it there is the sanctioned oracle boundary.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1434.test.js.
 * GATE:     crafted-entry — only the mode-clear arm occurs in attract (286 dispatches over
 *           2500 frames, all with command 0x04 and mode 0), gated on those real captured
 *           entries; the two walk-stepper arms and the mode-sign arm never occur, so they
 *           are gated on real entries with the mode and command poked to force each. RAM-
 *           only diff over the full state dump (every effect lives in RAM; a tail-jump
 *           writes nothing to the stack, so no exclusion window is needed).
 * LIVE-OUT: memory-only — every effect is produced by the delegated per-frame handler (the
 *           at-rest router or a walk stepper); this routine writes no RAM of its own and
 *           the caller reads no register back (it tail-jumps here).
 * NAMES:    the mode byte OBJECT_MOTION_MODE (0x8075) — the sibling steppers read it as a
 *           motion marker (advanceObjectWalkFrame) versus a sub-tile phase (walkActor), so
 *           its cross-routine meaning is unsettled.
 */

import { routeIdleObjectByMoveCommand } from "./routeIdleObjectByMoveCommand.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { walkActor } from "./walkActor.js";
import { OBJECT_MOTION_MODE } from "./names.js";

export function advanceObjectFrame(m) {
  const { regs, mem8 } = m;

  // The object's per-frame move command, handed over by the caller.
  const moveCommand = regs.a;
  const mode = mem8[OBJECT_MOTION_MODE];

  // At rest this frame: route on the command bits to the at-rest handler, which still
  // takes its command through the register slot the caller filled.
  if (mode === 0) {
    regs.l = moveCommand;
    return routeIdleObjectByMoveCommand(m);
  }

  // In motion: the command's direction bits pick the walk stepper directly; with neither
  // set, the sign of the mode byte decides between them.
  if (moveCommand & 0x01) return advanceObjectWalkFrame(m);
  if (moveCommand & 0x02) return walkActor(m);
  if (mode & 0x80) return advanceObjectWalkFrame(m);
  return walkActor(m);
}
