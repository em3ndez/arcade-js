// SPDX-License-Identifier: GPL-3.0-only
import { clearPlayfield } from "./clearPlayfield.js";
import { clearGameActive } from "./clearGameActive.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { waitShortDelay } from "./waitShortDelay.js";
import { returnToAttractFlow } from "./returnToAttractFlow.js";
import { TILT_RESET_ACTIVE, CREDIT_SCREEN_SHOWN, loc_1cbc, loc_3016 } from "./names.js";

// tiltReset — the tilt/panic warm restart: tear the game down and rejoin attract.
//
// WHAT IT IS
//   The multi-frame flow armed when the cabinet's tilt switch is hit. It blanks the play-field, marks the
//   reset as in progress (so the per-frame check below cannot re-arm it while it runs), drops the game,
//   types the tilt banner at the typing cadence, holds, then clears its guard and the credit-screen latch
//   and joins the attract teardown — leaving the machine back in attract as if the game never started.
//
// ROLE IN THE MACHINE
//   Guarded by TILT_RESET_ACTIVE (0x209a): set to 1 on entry, cleared to 0 at the end, so checkTiltInput
//   will not re-fire mid-reset. clearGameActive drops GAME_ACTIVE (0x20e9). typePacedSpriteRun draws the
//   0x04-glyph tilt banner (loc_1cbc -> screen slot loc_3016) paced on FRAME_DELAY_TIMER; waitShortDelay
//   is the hold. CREDIT_SCREEN_SHOWN (0x2093) is cleared so the credit screen can show again after the
//   reset. Control ends in returnToAttractFlow (the game-over -> attract join). It runs as a generator so
//   its typing and holds pace clock-free across many frames, and it is armed via m.nextMain as the
//   successor frame flow — it is NEVER run inside the interrupt body (that would hang the ISR).
//
// ROM 0x17d7-0x1803 (the fall-through body of the tilt handler; tail-jmp into 0x16c9).  Grounding: [seen].
//
// LIVE-OUT: none — control passes on into the attract cycle.
export function* tiltReset(m) {
  // Wipe the arena four times over (the ROM runs four clearPlayfield passes here), scrubbing the field
  // before the banner goes up.
  for (let n = 0x04; n !== 0; n--) clearPlayfield(m);
  // Mark the reset in progress so the per-frame checkTiltInput below sees the guard set and will not
  // re-arm this flow while it is still running.
  m.mem8[TILT_RESET_ACTIVE] = 0x01;
  // Drop the game-active flag and re-enable interrupts for the paced teardown that follows.
  clearGameActive(m);
  m.io.setInte(true);
  // Type the tilt banner (4 glyphs, loc_1cbc -> loc_3016) at the typing cadence, then hold so it reads.
  yield* typePacedSpriteRun(m, loc_1cbc, 0x04, loc_3016);
  yield* waitShortDelay(m);
  // Release the guard and clear the credit-screen latch so a fresh coin/credit screen can appear again.
  m.mem8[TILT_RESET_ACTIVE] = 0x00;
  m.mem8[CREDIT_SCREEN_SHOWN] = 0x00;
  // Join the attract teardown, returning the machine to the demo cycle.
  yield* returnToAttractFlow(m);
}

// checkTiltInput — the once-per-frame tilt poll run inside the vblank interrupt body.
//
// WHAT IT IS
//   Reads the tilt input every frame and, on a fresh tilt press, arms the warm-restart flow (tiltReset)
//   as the next foreground flow and reports true so the interrupt abandons the rest of this frame's
//   service. It is a no-op (returns false) on every frame the tilt is not pressed, or while a reset is
//   already underway.
//
// ROLE IN THE MACHINE
//   It is the interrupt body's one unconditional per-frame call (loc_0010). Tilt is input port 2 bit 2
//   (mask 0x04). The guard TILT_RESET_ACTIVE (0x209a) stops it re-arming while tiltReset runs. The reset
//   is armed via m.nextMain — the successor-frame hook — rather than run here, so the multi-frame teardown
//   never executes inside the ISR. Returning a boolean (not setting nextMain unconditionally) lets a
//   caller decide: a `true` tells the vblank body to stop servicing this frame, while a `false` lets it
//   fall through to the per-frame coin service (armCreditOnCoinPress), which banks a credit on a coin press.
//
// ROM 0x17cd-0x17d6 (the guard head of the tilt handler).  Grounding: [seen].
//
// LIVE-OUT: boolean — true when a tilt reset was just armed (caller should abandon the frame), else false.
export function checkTiltInput(m) {
  // No tilt pressed this frame -> nothing to do. (Port 2 bit 2 is the tilt switch.)
  if ((m.io.portIn(0x02) & 0x04) === 0) return false;
  // A reset is already running -> do not re-arm it (the guard cell is set by tiltReset).
  if (m.mem8[TILT_RESET_ACTIVE] !== 0) return false;
  // Fresh tilt press: arm the warm restart as the successor frame flow (run outside the ISR) and tell the
  // caller to abandon the rest of this frame.
  m.nextMain = () => tiltReset(m);
  return true;
}
