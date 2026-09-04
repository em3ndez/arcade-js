// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { setGameActive } from "./setGameActive.js";
import { finishAttractCycle } from "./finishAttractCycle.js";
import { GAME_IN_PROGRESS, GAME_OVER_TEXT, GAME_OVER_TEXT_VRAM_ADDR } from "./names.js";

// returnToAttractFlow — the bridge from a finished game back into the attract cycle.
//
// WHAT IT IS
//   Run when a game ends (and also reached by the tilt warm-restart). It types the game-over/closing
//   line at the typing cadence, holds a beat so it can be read, wipes the arena, tears down the in-game
//   state (game no longer in progress, fleet-march tone silenced), re-marks the machine "active" for the
//   attract screens, and hands off into the attract-round teardown that loops the demo forever.
//
// ROLE IN THE MACHINE
//   Callers are gameOverFlow (a one-player game, or both players out) and the tilt reset (tiltReset).
//   typePacedSpriteRun draws 0x0a glyphs from the game-over text source GAME_OVER_TEXT to the screen slot
//   GAME_OVER_TEXT_VRAM_ADDR, pacing on FRAME_DELAY_TIMER; waitLongDelay is the read-it hold. It then drops
//   GAME_IN_PROGRESS (0x20ef) — the flag the fleet-march metronome gates on, so the "footsteps" stop —
//   and writes 0 to sound port 5, silencing any march tone still latched. setGameActive raises
//   GAME_ACTIVE (0x20e9); attract counts as active, so the interrupt bodies keep servicing the screen.
//   Finally it delegates into finishAttractCycle (ROM tail-jmp to 0x0b89), which paints the credit /
//   high-score panel, runs the handshaked reveal, flips SCREEN_MODE_TOGGLE, and loops back to the attract
//   cycle join.
//
// ROM 0x16c9-0x16e5 (then tail into 0x0b89).  Grounding: [seen].
//
// LIVE-OUT: none — control passes on into the attract cycle; effects are in memory + the sound port.
export function* returnToAttractFlow(m) {
  // Type the closing line one glyph at a time at the typing cadence (paces on FRAME_DELAY_TIMER), then
  // hold so it stays on screen a beat before teardown.
  yield* typePacedSpriteRun(m, GAME_OVER_TEXT, 0x0a, GAME_OVER_TEXT_VRAM_ADDR);
  yield* waitLongDelay(m);
  // Wipe the arena (margin-preserving play-field clear) ahead of the attract screens.
  clearPlayfield(m);
  // Leave in-game state: clear GAME_IN_PROGRESS so the fleet-march metronome no longer beats, and write 0
  // to sound port 5 to silence any march/saucer tone still latched there.
  m.mem8[GAME_IN_PROGRESS] = 0x00;
  m.io.portOut(0x05, 0x00);
  // Re-mark the machine active: attract is an "active" state, so the interrupt bodies keep drawing.
  setGameActive(m);
  // Hand off into the attract-round teardown, which paints the credit/high-score panel and loops the demo.
  yield* finishAttractCycle(m);
}
