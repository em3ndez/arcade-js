// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectFromControl — advance the tracked object one frame from its control input.
 * The last arm of the per-frame object/state dispatcher: if a reaction animation owns the
 * object the move is deferred (its deferral record staged); otherwise it picks the move
 * command (the attract demo's steering while the demo runs at game mode 3 and up, else the
 * debounced joystick) and hands it to the per-frame update dispatcher, which positions or
 * animates the object. The demo's steering is consumed exactly where the joystick would be.
 */

import { REACTION_STATE, GAME_STATE, DEMO_STEER_DIR, IN0_DEBOUNCED } from "./names.js";
import { advanceObjectFrame } from "./advanceObjectFrame.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

export function stepObjectFromControl(m) {
  const { mem8, regs } = m;

  // A reaction animation owns the object -> defer its move and stage the deferral record.
  if (mem8[REACTION_STATE] !== 0) return stageObjectSpriteRecord(m);

  // Pick the move command: the demo's steering while it runs, else the debounced joystick.
  const runningDemo = mem8[GAME_STATE] >= 3;
  regs.a = runningDemo ? mem8[DEMO_STEER_DIR] : mem8[IN0_DEBOUNCED];

  // Hand the command to the per-frame update dispatcher, which positions, animates, or
  // stands the object still. It reads the command from the slot the caller fills, so
  // setting it here is the sanctioned boundary into that still-register-ABI routine.
  return advanceObjectFrame(m);
}
