// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  SCRIPT_COL_CHECK_TICK,
  SCRIPT_WRITE_PTR,
  ROUND_TILE_DST,
  INTRO_DELAY_CKSUM_WORD,
  MAIN_GAME_STATE,
  ATTRACT_SCRIPT_PTR_TABLE,
} from "./names.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blankRowThenFloodColorsAndAdvanceAttract } from "./blankRowThenFloodColorsAndAdvanceAttract.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
/**
 * advanceAttractSequenceToPlay — attract sub-state 6, the "text-draw script has run;
 * hand the machine over to play" step of the attract loop.
 *
 * WHAT IT IS
 *   ROM 0x0b32. Grounding: [seen].
 *
 *   During the attract/demo loop the top-level selector MAIN_GAME_STATE (0x8805) sits at 1,
 *   and each frame the attract sub-state machine dispatches on ATTRACT_SUBSTATE (0x8e51). This
 *   routine is the sub-state-6 handler: the phase that paints the demo's scripted intro text a
 *   frame at a time and, once the whole script has drained, promotes the machine into play. It
 *   does three things every frame — animate the attract screen, tick the text-draw script, and
 *   (periodically) run an anti-tamper checksum — and only on the checksum frame does it hand off
 *   to the board builder.
 *
 *   ANTI-TAMPER LATTICE. Pooyan's ROM is riddled with self-checks that make a patched or
 *   bit-rotted image misbehave rather than run. Two of them live here. The first is a cheap
 *   per-frame guard on the HUD colour strip; the second is a 14x29 column checksum over the
 *   round-number tile block, verified against a two-byte reference the intro script itself has
 *   deposited. Either miss diverts the machine backward through the attract states instead of
 *   letting it reach play, so a tampered board can never start a game.
 *
 * LIVE-OUT: none — a void handler. Every exit is either a plain return (still mid-script) or a
 * tail into a sibling attract/board handler. Its side effects are the memory it writes on the
 * way: the two frame timers (0x8d41, 0x8e50), the sub-state (0x8e51), the script write pointer
 * (0x8e56), the tick countdown (0x8e53), and — on a clean checksum pass — the cleared check word
 * (0x8f48) plus MAIN_GAME_STATE (0x8805) advanced to play.
 */
const ROW_STRIDE = 0x20; // one tile row = 0x20 cells; the integrity pair compares a cell to the one a row below it (-0x20)
const PAIR_COUNT = 10; // ten strided pairs verified across the HUD colour strip
const CHECK_COLS = 14; // column-checksum outer count: 14 tile columns swept
const CHECK_ROWS = 29; // column-checksum inner count: 29 tile bytes summed per column
const PLAY_STATE = 3; // MAIN_GAME_STATE value that means "live play frame", seated on a clean checksum pass

export function advanceAttractSequenceToPlay(m) {
  const { mem8, mem16 } = m;

  // STEP 1 — HUD colour-strip integrity guard (anti-tamper).
  // The first tile column of the HUD colour region is laid out so that each cell equals the cell
  // one tile row (0x20) below it. Walk ten such pairs up from HUD_INTEGRITY_STRIP_A (0x82bc),
  // stepping the cursor back one row (-0x20) each time. Any mismatch means the colour plane has
  // been corrupted, so bail straight back to the attract sub-state-0 handler and restart the loop.
  let row = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < PAIR_COUNT; i++) {
    const top = mem8[row];
    row = u16(row - ROW_STRIDE);
    if (top !== mem8[row]) return resetToAttractScreenStart(m); // row mismatch -> re-enter sub-state 0
  }

  // STEP 2 — advance the attract screen's animation.
  // ANIM_FRAME_COUNTER (0x8d41) is the global anim clock; in attract it counts down from 0x0a.
  // Decrement it (wrapping to a byte); on the frame it hits zero, step the 4-phase attract
  // animation and repaint its tile block. Then, every frame regardless, step the four demo
  // object records and rebuild the hardware sprite display list so the demo actors move.
  const anim = (mem8[ANIM_FRAME_COUNTER] - 1) & 0xff;
  mem8[ANIM_FRAME_COUNTER] = anim;
  if (anim === 0) advanceAttractAnimationAndRepaint(m); // wrap -> advance the attract animation
  advanceFourObjectAnimsAndRebuildList(m); // step the object records + rebuild the sprite list

  // STEP 3 — tick the text-draw script's per-frame timer.
  // SCRIPT_FRAME_TIMER (0x8e50) is the countdown between script steps. Decrement it; while it is
  // still running there is nothing to emit this frame, so return and let the next frame retick.
  const timer = (mem8[SCRIPT_FRAME_TIMER] - 1) & 0xff;
  mem8[SCRIPT_FRAME_TIMER] = timer;
  if (timer !== 0) return; // script timer still running

  // STEP 4 — the timer expired: advance one script step.
  // Reseed the frame timer to 1 (fire again next frame), step the sub-state selector one back
  // (0x8e51 walks the attract phases downward), and seat the next script write destination:
  // index the attract script-pointer table (0x0bab) by SCRIPT_COL_CHECK_TICK-1 and store the
  // looked-up word into SCRIPT_WRITE_PTR (0x8e56), the VRAM cursor the text-draw emits through.
  mem8[SCRIPT_FRAME_TIMER] = 1;
  mem8[ATTRACT_SUBSTATE] = (mem8[ATTRACT_SUBSTATE] - 1);
  const idx = (mem8[SCRIPT_COL_CHECK_TICK] - 1) & 0xff;
  mem16[SCRIPT_WRITE_PTR] = fetchWordFromTableIndex(m, idx, ATTRACT_SCRIPT_PTR_TABLE); // DE = table[idx]

  // STEP 5 — count down to the checksum frame.
  // SCRIPT_COL_CHECK_TICK (0x8e53) gates how often the expensive column checksum runs. Decrement
  // it; until it reaches zero this is an ordinary script frame, so return without checksumming.
  const tick = (mem8[SCRIPT_COL_CHECK_TICK] - 1) & 0xff;
  mem8[SCRIPT_COL_CHECK_TICK] = tick;
  if (tick !== 0) return; // not a checksum frame yet

  // STEP 6 — the checksum frame: reseed the timers, then compute the round-tile checksum.
  // Reload the frame timer to 0x96 and reset the sub-state to 0. Then sweep 14 columns of the
  // round-number tile block from ROUND_TILE_DST (0x8462): sum 29 tile bytes per column into an
  // 8-bit running total (sumLow), counting each 8-bit overflow into a separate carry tally, then
  // skip 3 bytes to reach the next 0x20-aligned column (29 + 3 = 0x20). This mirrors the Z80's
  // add-with-carry-count: sumLow is the low byte of the checksum, carries is the high byte.
  mem8[SCRIPT_FRAME_TIMER] = 0x96;
  mem8[ATTRACT_SUBSTATE] = 0;
  let ptr = ROUND_TILE_DST;
  let sumLow = 0;
  let carries = 0;
  for (let c = 0; c < CHECK_COLS; c++) {
    for (let r = 0; r < CHECK_ROWS; r++) {
      const raw = sumLow + mem8[ptr];
      if (raw > 0xff) carries = (carries + 1) & 0xff;
      sumLow = raw & 0xff;
      ptr = u16(ptr + 1);
    }
    ptr = u16(ptr + 3); // skip to the next 0x20-aligned column
  }

  // STEP 7 — verify the checksum against the intro script's reference (anti-tamper) and decide.
  // INTRO_DELAY_CKSUM_WORD (0x8f48) holds a pointer the intro machine parked; it addresses the
  // two expected bytes. Compare the low byte first: a miss means the tile block was tampered, so
  // fall back to the attract sub-state-0 handler. Then the high (carry) byte: a miss instead
  // routes to the attract sub-state-1 handler (the colour-flood rebuild path). Only when both
  // match is the board considered intact.
  let vptr = mem16[INTRO_DELAY_CKSUM_WORD];
  if (sumLow !== mem8[vptr]) return resetToAttractScreenStart(m); // low-byte miss
  vptr = u16(vptr + 1);
  if (carries !== mem8[vptr]) return blankRowThenFloodColorsAndAdvanceAttract(m); // high-byte miss

  // STEP 8 — clean pass: promote the machine into play.
  // Clear the two check-word bytes at 0x8f48 (the pointer is consumed), set the top-level
  // selector MAIN_GAME_STATE (0x8805) to play (3), and tail into the board builder to reset the
  // actor/sprite state for the fresh board the player is about to take over.
  mem8[INTRO_DELAY_CKSUM_WORD] = 0; // clean pass: clear the check word
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = 0;
  mem8[MAIN_GAME_STATE] = PLAY_STATE;
  return resetActorStateForBoard(m); // advance to the next screen builder
}
