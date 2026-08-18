// SPDX-License-Identifier: GPL-3.0-only
/**
 * setAttractIdleMode  —  ROM 0x0e74  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The one-line "park the attract loop" tail. It forces the machine's top-level mode selector
 *   GAME_MODE (0x83d6) to 5 — the attract-idle state. Attract-idle is the quiet, credits-present
 *   tail of the attract sequence: the demo river has finished playing (or a coin is now waiting),
 *   so the machine stops running the scripted demo and holds at the "insert coin / press start"
 *   idle screen instead of looping the animation again.
 *
 * WHERE IT SITS
 *   A shared tail reached from two points in the attract subsystem, both of which mean "the demo
 *   should stop here":
 *     · driveAttractDemoSequencer (0x0e7a) tails here on the very first check of each vblank when
 *       CREDIT_BCD (0x83e1) is nonzero — a coin has been banked, so don't start another demo frame,
 *       drop straight to the idle/attract screen so the player can begin.
 *     · stampAttractDemoCell (0x0de0) tails here after it has placed the last of the seven demo
 *       board cells (its phase counter drains and it resets the sequencer) — the demo has played to
 *       completion, so idle until it is time to run again.
 *
 * LIVE-OUT
 *   Memory only: a single byte written to GAME_MODE (0x83d6). No return value, no register the
 *   caller reads. Every consumer of the mode change reads it back out of that cell on a later frame.
 */
import { GAME_MODE } from "./names.js";

// The attract-idle mode number. GAME_MODE (0x83d6) is the machine's top-level state selector; the
// dispatchers that read it (e.g. dispatchGameModeFrame 0x0d11) treat 5 as "attract-idle", the
// credits-present / demo-complete resting state that shows the idle attract screen.
const ATTRACT_IDLE = 5;

export function setAttractIdleMode(m) {
  // Stamp the mode selector and return. This is idempotent — writing 5 over 5 is a no-op — which is
  // why the sequencer can tail here on every vblank that credits are present without any guard: the
  // machine simply stays parked in attract-idle until some other mode transition moves GAME_MODE on.
  m.mem8[GAME_MODE] = ATTRACT_IDLE;
}
