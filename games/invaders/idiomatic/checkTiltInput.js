// SPDX-License-Identifier: GPL-3.0-only
import { clearPlayfield } from "./clearPlayfield.js";
import { clearGameActive } from "./clearGameActive.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { waitShortDelay } from "./waitShortDelay.js";
import { returnToAttractFlow } from "./returnToAttractFlow.js";
import { TILT_RESET_ACTIVE, CREDIT_SCREEN_SHOWN, loc_1cbc, loc_3016 } from "./names.js";

// The tilt/panic warm restart. Wipe the play-field, mark the reset in progress (so the per-frame check
// below does not re-arm while it runs), drop the game-active flag, type the tilt banner at the typing
// cadence, hold, then clear the guard and the credit-screen latch and join the attract teardown. A
// generator so its typing and hold pace clock-free; armed as the successor frame flow, never run inside
// the interrupt body.
export function* tiltReset(m) {
  for (let n = 0x04; n !== 0; n--) clearPlayfield(m);
  m.mem8[TILT_RESET_ACTIVE] = 0x01;
  clearGameActive(m);
  m.io.setInte(true);
  yield* typePacedSpriteRun(m, loc_1cbc, 0x04, loc_3016);
  yield* waitShortDelay(m);
  m.mem8[TILT_RESET_ACTIVE] = 0x00;
  m.mem8[CREDIT_SCREEN_SHOWN] = 0x00;
  yield* returnToAttractFlow(m);
}

// Per-frame tilt check, run by the vblank interrupt body. Read the tilt input; do nothing unless its bit
// is set and no reset is already in progress. On a fresh tilt press, arm the warm-restart reset flow as
// the successor frame flow and report true so the caller abandons the rest of this frame's service.
export function checkTiltInput(m) {
  if ((m.io.portIn(0x02) & 0x04) === 0) return false;
  if (m.mem8[TILT_RESET_ACTIVE] !== 0) return false;
  m.nextMain = () => tiltReset(m);
  return true;
}
