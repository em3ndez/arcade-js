// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectFrame — pick the tracked object's per-frame update from its mode and move
 * command. Runs once per frame for the object being processed; the mode byte decides the
 * broad case, the move command the fine one. Mode clear (at rest): hand the command to the
 * at-rest router, which positions or animates the object, or stands it still. Mode set (in
 * motion): run one of two walk steppers — the command's first direction bit selects the walk
 * step against a moving reference, its second the momentum step, and with neither the sign of
 * the mode byte chooses. The move command is the attract demo's steering byte, or the
 * debounced joystick otherwise — the same byte the at-rest router consumes.
 */

import { routeIdleObjectByMoveCommand } from "./routeIdleObjectByMoveCommand.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { walkActor } from "./walkActor.js";
import { OBJECT_MOTION_MODE } from "./names.js";

export function advanceObjectFrame(m, moveCommand = m.regs.a) {
  const { mem8 } = m;

  const mode = mem8[OBJECT_MOTION_MODE];

  // At rest this frame: route on the command bits to the at-rest handler.
  if (mode === 0) {
    return routeIdleObjectByMoveCommand(m, moveCommand);
  }

  // In motion: the command's direction bits pick the walk stepper; with neither, the mode sign decides.
  if (moveCommand & 0x01) return advanceObjectWalkFrame(m);
  if (moveCommand & 0x02) return walkActor(m);
  if (mode & 0x80) return advanceObjectWalkFrame(m);
  return walkActor(m);
}
