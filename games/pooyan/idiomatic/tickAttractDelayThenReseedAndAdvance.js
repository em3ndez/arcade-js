// SPDX-License-Identifier: GPL-3.0-only
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import {
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
  ATTRACT_SCRIPT_TABLE_BASE,
} from "./names.js";
/**
 * tickAttractDelayThenReseedAndAdvance — attract sub-state 3: a per-frame delay gate that,
 * on expiry, wipes the board back to a blank slate and hands the attract sequence to its
 * next phase.
 *
 * WHAT IT IS
 *   ROM 0x0986-0x099b. Grounding: [seen]. When the machine is left alone it runs an
 *   endless demo/attract loop, and that loop is a small state machine: the selector
 *   ATTRACT_SUBSTATE (0x8e51) picks one of nine handlers, and the top-level game state
 *   (0x8805 == 1) routes each frame to whichever handler the selector names. This routine
 *   is handler number 3. Its whole job is to sit on a timer: it does nothing visible for
 *   a run of frames, and only when that timer runs out does it act — tearing the demo
 *   board down and pointing the attract machine at the next thing to show.
 *
 * ROLE IN THE MACHINE
 *   The attract loop alternates between "show something" phases and "pause, then move on"
 *   phases. This is one of the pause-then-move-on phases. The prior handler set up a
 *   screen and loaded SCRIPT_FRAME_TIMER (0x8e50) with a frame count; this handler is
 *   entered once per frame and simply counts that timer down. While it is still running,
 *   the handler returns immediately and the demo screen stays put. On the single frame
 *   the count hits zero, the handler does its real work: it scrubs every moving object
 *   off the board, re-arms a full-screen tile fill, steps the attract selector forward
 *   one notch (so a different handler runs next frame), and seats the attract-script
 *   cursor at the start of the script word table — priming the phase that types the next
 *   run of attract text onto the freshly cleared field.
 *
 * WHAT IT LEAVES IN MEMORY (LIVE-OUT)
 *   On a still-counting frame: only SCRIPT_FRAME_TIMER (0x8e50), one lower.
 *   On the expiry frame it additionally leaves:
 *     - the sprite display list and actor arena zeroed (via the board scrub),
 *     - the row-by-row tile fill armed (write cursor + row count seeded),
 *     - ATTRACT_SUBSTATE (0x8e51) advanced by one, so next frame dispatches the next
 *       attract handler,
 *     - INTRO_DELAY_CKSUM_WORD (0x8f48) holding ATTRACT_SCRIPT_TABLE_BASE (0x0b26), the
 *       attract-script cursor pointed at the top of the word table.
 *   Nothing is left in the working registers for a caller to read — the game state
 *   handler that follows reloads its own working values from memory.
 */
export function tickAttractDelayThenReseedAndAdvance(m) {
  const { mem8 } = m;

  // STEP 1 — tick the delay timer, and gate on it.
  // SCRIPT_FRAME_TIMER (0x8e50) is the attract/intro script's per-frame countdown. Drop
  // it by one, wrapped to a byte (an 8-bit counter, so 0x00 - 1 would roll to 0xff — but
  // the setup phase always loads a positive count, so in practice it walks down to 0).
  const remaining = (mem8[SCRIPT_FRAME_TIMER] - 1) & 0xff;
  mem8[SCRIPT_FRAME_TIMER] = remaining;
  // While the timer has not yet reached zero the delay is still in progress: leave the
  // demo screen exactly as it is and do nothing more this frame.
  if (remaining !== 0) return; // still counting down

  // STEP 2 — the timer expired: wipe the moving world off the board.
  // Zero the sprite display list at 0x8840 (so no sprite is left on screen) and the actor
  // arena at 0x8a80 (so every "slot active" flag reads 0 and the spawners see an empty
  // board). This is the board-init scrub that gives the next attract phase a clean field.
  zeroSpriteListAndActorArena(m); // zero the sprite display list + actor/object arena
  // Re-arm the row-by-row tilemap fill from the fixed top of the playfield tile plane
  // (0x8402): seat the write cursor TILE_FILL_PTR (0x880b) and the row counter
  // FILL_ROW_COUNTER (0x8809) to the full grid height, so the fill loop will repaint the
  // whole background over the coming frames.
  armTileFillFromPlayfieldBase(m); // re-arm the row-by-row tile fill

  // STEP 3 — advance the attract state machine one step.
  // Bump the attract sub-state selector ATTRACT_SUBSTATE (0x8e51) by one so that next
  // frame the dispatch (table 0x08a1) lands on the following handler instead of this one.
  // The store is a single byte, so the increment wraps modulo 256.
  mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1; // advance the sub-state (byte write wraps)

  // STEP 4 — prime the attract-script cursor for the phase that comes next.
  // The next attract phase walks a script whose read position lives in the 16-bit cursor
  // word INTRO_DELAY_CKSUM_WORD (0x8f48). Seat that cursor at ATTRACT_SCRIPT_TABLE_BASE
  // (0x0b26), the top of the attract-script word table, so the following phase begins
  // typing text from the first script entry. The word is stored low byte first
  // (little-endian): low half at 0x8f48, high half at 0x8f49.
  const lo = ATTRACT_SCRIPT_TABLE_BASE & 0xff;
  const hi = ATTRACT_SCRIPT_TABLE_BASE >> 8;
  mem8[INTRO_DELAY_CKSUM_WORD] = lo; // seat the table base into the cursor word, little-endian
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = hi;
}
