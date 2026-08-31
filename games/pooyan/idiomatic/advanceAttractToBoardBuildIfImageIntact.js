// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { blankRowThenFloodColorsAndAdvanceAttract } from "./blankRowThenFloodColorsAndAdvanceAttract.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  SCRIPT_COL_CHECK_TICK,
  SCRIPT_WRITE_PTR,
  INTRO_DELAY_CKSUM_WORD,
  LAUNCH_SEQ_COUNTER,
  ROUND_TILE_DST,
  MAIN_GAME_STATE,
  ATTRACT_SCRIPT_PTR_TABLE,
} from "./names.js";
/**
 * advanceAttractToBoardBuildIfImageIntact — the attract-mode "advance to the next board build" handler
 * that the machine reaches ONLY when it suspects it is running on a tampered program image.
 *
 * WHAT IT IS
 *   The demo/attract loop is driven by a small scripted sub-state machine (selector ATTRACT_SUBSTATE):
 *   each frame it counts down timers, repaints animated tile blocks, seats the next text-draw script
 *   pointer, and eventually commits the machine forward into the next screen. The normal owner of
 *   attract sub-state 6 (the "advance into the board build" step) is advanceAttractSequenceToPlay.
 *   This routine is a second, byte-for-byte copy of that handler that lives at a different ROM
 *   address. The attract sub-state-0 handler holds an integrity guard: it compares the primary code
 *   copy against a shadow copy, and when the primary has been patched the compare mismatches and the
 *   guard vectors the frame here to the DUPLICATE instead of the original. So a cracked ROM keeps
 *   playing the correct attract choreography, while this copy folds in its own self-checking traps
 *   that quietly bail out (or bounce back to the start of the attract loop) the moment a scanned
 *   region of video RAM or the round tile block fails its checksum — the ROM's characteristic
 *   anti-tamper style of degrading rather than crashing.
 *
 * ROLE IN THE MACHINE
 *   Attract sub-state 6 handler (tamper-clone). Runs the same per-frame attract work as its twin —
 *   animation tick, script-pointer advance, timer dwell — and, when its dwell finally expires, either
 *   commits into the next board (MAIN_GAME_STATE=3, hand to the board-reset builder) or, on any
 *   integrity mismatch, tails to a recovery handler.
 *
 * ROM ADDRESS: 0x7071-0x70e9.
 * Grounding: [code].
 *
 * LIVE-OUT: none (void handler). All effects are memory writes; the finish and every mismatch path
 *   are tail calls into the next handler.
 */
export function advanceAttractToBoardBuildIfImageIntact(m) {
  const { mem8, mem16 } = m;

  // Trap 1 — colour-strip integrity. HUD_INTEGRITY_STRIP_A (0x82bc) heads a video-RAM column whose
  // cells are laid out so that each row equals the row one tile-stride (0x20 bytes) above it. Walk
  // 0x0a cells upward (address -= 0x20 each pass) and require every cell to match its upper neighbour.
  // A single mismatch means the screen image has been disturbed, so abandon this frame and drop back
  // to the top of the attract loop (attract sub-state 0, resetToAttractScreenStart at ROM 0x08b3).
  let hl = HUD_INTEGRITY_STRIP_A;
  for (let b = 0x0a; b > 0; b--) { // column integrity: each cell == the one 0x20 above
    const a = mem8[hl];
    hl = u16(hl - 0x20);
    if (a !== mem8[hl]) return resetToAttractScreenStart(m);
  }

  // Per-frame attract animation. ANIM_FRAME_COUNTER (0x8d41) is the global frame counter; here it is
  // used as a down-counter for the 4-phase attract animation. Tick it, and when it reaches 0 advance
  // that animation one phase and repaint its tile block (advanceAttractAnimationAndRepaint, ROM 0x0a28;
  // it reseeds the counter). Then, every frame regardless, step the four attract object records'
  // animations and rebuild the sprite display list (advanceFourObjectAnimsAndRebuildList, ROM 0x09f8).
  mem8[ANIM_FRAME_COUNTER] = u8(mem8[ANIM_FRAME_COUNTER] - 1);
  if (mem8[ANIM_FRAME_COUNTER] === 0) advanceAttractAnimationAndRepaint(m);
  advanceFourObjectAnimsAndRebuildList(m);

  // Script-step dwell. SCRIPT_FRAME_TIMER (0x8e50) is the per-frame countdown that paces the attract
  // text-draw script. Decrement it; while it is still nonzero the current script step has not elapsed,
  // so there is nothing more to do this frame.
  mem8[SCRIPT_FRAME_TIMER] = u8(mem8[SCRIPT_FRAME_TIMER] - 1);
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return;

  // Dwell expired — advance one script step. Reload SCRIPT_FRAME_TIMER (0x8e50) to 0x01 so the next
  // frame lands here again immediately, and step the attract sub-state selector ATTRACT_SUBSTATE
  // (0x8e51) down one. Seat the next text-draw destination: index the attract-script word table
  // ATTRACT_SCRIPT_PTR_TABLE (ROM 0x0bab) by SCRIPT_COL_CHECK_TICK-1, and store the fetched word as
  // the script write pointer SCRIPT_WRITE_PTR (0x8e56). Then tick the column-check countdown
  // SCRIPT_COL_CHECK_TICK (0x8e53); while it has not drained to 0 there are more script columns to
  // emit, so return and let the following frames run the remaining steps.
  mem8[SCRIPT_FRAME_TIMER] = 0x01;
  mem8[ATTRACT_SUBSTATE] = u8(mem8[ATTRACT_SUBSTATE] - 1);
  const idx = u8(mem8[SCRIPT_COL_CHECK_TICK] - 1);
  mem16[SCRIPT_WRITE_PTR] = fetchWordFromTableIndex(m, idx, ATTRACT_SCRIPT_PTR_TABLE);
  mem8[SCRIPT_COL_CHECK_TICK] = u8(mem8[SCRIPT_COL_CHECK_TICK] - 1);
  if (mem8[SCRIPT_COL_CHECK_TICK] !== 0) return;

  // Final script column reached — arm the commit. Reload SCRIPT_FRAME_TIMER (0x8e50) to 0x96 (150
  // frames, ~2.5s of settle time) and force ATTRACT_SUBSTATE (0x8e51) to 0 so, whatever happens next,
  // control has left sub-state 6.
  mem8[SCRIPT_FRAME_TIMER] = 0x96;
  mem8[ATTRACT_SUBSTATE] = 0;

  // Trap 2 — round tile-block checksum. Fold the round's 3x3-derived tile block into a 16-bit sum:
  // ROUND_TILE_DST (0x8462) is the video-RAM base, laid out as 14 columns of 29 rows. Accumulate a
  // running total with the low byte in `e` and each carry out of it counted in `d`. Between columns the
  // pointer skips forward by 3 bytes (l += 3, carrying into h) so it lands on the next column's base
  // rather than reading the inter-column padding.
  let d = 0;
  let e = 0;
  let ptr = ROUND_TILE_DST;
  for (let col = 0x0e; col > 0; col--) { // 14 columns
    for (let row = 0x1d; row > 0; row--) { // 29 rows, running sum in E with overflow into D
      const sum = e + mem8[ptr];
      if (sum > 0xff) d = u8(d + 1);
      e = u8(sum);
      ptr = u16(ptr + 1);
    }
    let ph = ptr >> 8; // step to the next column: l += 3, carry into h
    const pl = (ptr & 0xff) + 0x03;
    if (pl > 0xff) ph = u8(ph + 1);
    ptr = (ph << 8) | (pl & 0xff);
  }

  // Compare the checksum against its stored expected value. INTRO_DELAY_CKSUM_WORD (0x8f48) holds a
  // pointer to the two expected checksum bytes; follow it. The low byte of the sum (`e`) must equal the
  // first expected byte — a miss means the tile block is corrupt, so drop back to the top of the
  // attract loop (resetToAttractScreenStart, ROM 0x08b3). Advance the pointer and require the carry
  // count (`d`) to equal the second expected byte; a miss here diverts to the colour-flood recovery
  // handler (blankRowThenFloodColorsAndAdvanceAttract, ROM 0x08e9).
  let check = mem16[INTRO_DELAY_CKSUM_WORD]; // dereference the stored checksum pointer
  if (e !== mem8[check]) return resetToAttractScreenStart(m);
  check = u16(check + 1);
  if (mem8[check] !== d) return blankRowThenFloodColorsAndAdvanceAttract(m);

  // Image verified clean — commit into the next board. Zero both bytes of the checksum-pointer word
  // (INTRO_DELAY_CKSUM_WORD at 0x8f48 and, one byte up, LAUNCH_SEQ_COUNTER at 0x8f49), set the
  // top-level state selector MAIN_GAME_STATE (0x8805) to 0x03, and hand the frame to the board-reset
  // builder (resetActorStateForBoard, ROM 0x0e00), which stands up the actor/sprite state for the new
  // screen.
  mem8[INTRO_DELAY_CKSUM_WORD] = 0;
  mem8[LAUNCH_SEQ_COUNTER] = 0;
  mem8[MAIN_GAME_STATE] = 0x03;
  return resetActorStateForBoard(m); // advance to the next screen builder
}
