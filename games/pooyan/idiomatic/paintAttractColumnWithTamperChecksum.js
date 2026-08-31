// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { runObjectAndEnemyActorUpdate } from "./runObjectAndEnemyActorUpdate.js";
import { dispatchSelfTestState } from "./dispatchSelfTestState.js";
import {
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  SCRIPT_READ_PTR,
  SCRIPT_STEP_COUNTDOWN,
  SCRIPT_WRITE_PTR,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
} from "./names.js";
/**
 * paintAttractColumnWithTamperChecksum — the anti-tamper twin of the attract sub-state-5 text handler.
 *
 * WHAT IT IS
 *   Pooyan's attract mode types its title/instruction text onto the screen one vertical column at a
 *   time. The routine that does that typing for sub-state 5 is typeAttractTextColumn, at ROM 0x0ac8.
 *   This routine is a byte-for-byte duplicate of that handler, sitting at a second ROM address. The
 *   two copies are identical instruction-for-instruction; only their entry addresses differ. The
 *   machine runs this copy instead of the original whenever the state-3 handler's integrity guard
 *   finds that its expected code no longer matches — i.e. when the shipped image has been altered.
 *   So this clone is one tooth of Pooyan's anti-tamper lattice: on an intact board it behaves exactly
 *   like the ordinary text-typing handler, but its checksum arms (below) redirect control into the
 *   tamper traps the moment the placed column no longer sums to its stored signature.
 *
 * ROLE IN THE MACHINE
 *   A per-frame attract-mode handler. Each call places (at most) one more cell of the current text
 *   column into the tilemap, keeps the attract animation ticking, and — once a full column has been
 *   laid down — advances the attract sub-state and validates the placed column against a table of
 *   expected 16-bit checksums. It calls out to advanceAttractAnimationAndRepaint (the 4-phase attract
 *   animation), advanceFourObjectAnimsAndRebuildList (the sprite display list), and, on a checksum
 *   failure, tails into dispatchSelfTestState or runObjectAndEnemyActorUpdate as tamper landings.
 *
 * ROM 0x6df9-0x6e56.  Grounding: [code].
 *
 * LIVE-OUT: none — a void frame step. Everything it does is a write into the attract work cells /
 *   tilemap, or a tail call into another handler; it returns no value.
 */
const CKSUM_ROWS = 0x0e; // a text column spans 14 tilemap rows
const ROW_STRIDE = 0x20; // the 32x32 tilemap is 32 cells wide, so +0x20 steps down one row

export function paintAttractColumnWithTamperChecksum(m) {
  const { mem8, mem16 } = m;

  // --- Keep the attract animation running -------------------------------------------------------
  // ANIM_FRAME_COUNTER (0x8d41) is the global attract animation countdown, reseeded to 0x0a and
  // ticked down one per frame. When it reaches 0 the 4-phase attract animation is due to step, so
  // advanceAttractAnimationAndRepaint (ROM 0x0a28) reseeds it and repaints the animated tile block.
  mem8[ANIM_FRAME_COUNTER]--; // frame countdown
  if (mem8[ANIM_FRAME_COUNTER] === 0) advanceAttractAnimationAndRepaint(m); // wrap -> reseed + repaint
  // Step the four attract object records' animations and rebuild the sprite display list from them
  // (ROM 0x09f8), so the demo's moving sprites advance every frame regardless of the text pacing.
  advanceFourObjectAnimsAndRebuildList(m); // advance the scripted sprite step

  // --- Pace the text typing ---------------------------------------------------------------------
  // SCRIPT_FRAME_TIMER (0x8e50) is the per-frame countdown that gates how fast bytes are emitted.
  // While it is still nonzero the column is mid-wait: place nothing this frame and return. On the
  // frame it reaches 0 we emit one byte and reload the timer to 0x02, so a byte lands every 2 frames.
  mem8[SCRIPT_FRAME_TIMER]--;
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return; // timer still running -> wait
  mem8[SCRIPT_FRAME_TIMER] = 0x02; // reload

  // --- Emit one tilemap cell from the text script -----------------------------------------------
  // SCRIPT_READ_PTR (0x8e54) is a 16-bit cursor into the ROM text-script data; SCRIPT_WRITE_PTR
  // (0x8e56) is a 16-bit cursor into video RAM. Read the next script byte, advance the read cursor,
  // write the byte to the current screen cell, then back the write cursor UP one tilemap row
  // (dst - 0x20): the column is typed bottom-to-top, one cell per emit.
  const src = mem16[SCRIPT_READ_PTR]; // pull the next script byte
  const b = mem8[src];
  mem16[SCRIPT_READ_PTR] = u16(src + 1);
  const dst = mem16[SCRIPT_WRITE_PTR]; // place it, then back the write cursor up one row
  mem8[dst] = b;
  mem16[SCRIPT_WRITE_PTR] = u16(dst - ROW_STRIDE);

  // --- Column-complete gate ---------------------------------------------------------------------
  // SCRIPT_STEP_COUNTDOWN (0x8e52) counts the cells remaining in the current column. Until it drains
  // there is more of this column to type, so return. When it hits 0 the column is finished: reseed
  // the step countdown to 0x0d (14 cells) and the frame timer to 0x14 for the next column's cadence,
  // and bump ATTRACT_SUBSTATE (0x8e51), the attract sequence's sub-state selector, to advance the demo.
  mem8[SCRIPT_STEP_COUNTDOWN]--;
  if (mem8[SCRIPT_STEP_COUNTDOWN] !== 0) return; // step countdown still running
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d; // reseed the step + frame timers
  mem8[SCRIPT_FRAME_TIMER] = 0x14;
  mem8[ATTRACT_SUBSTATE]++; // advance the attract sub-state

  // --- Checksum the column just placed ----------------------------------------------------------
  // Fold the 14 cells of the completed column into a 16-bit accumulator, reading from the current
  // write cursor downward one tilemap row (+0x20) at a time. This is the anti-tamper signature: the
  // exact bytes a correct text script would have deposited sum to a value the ROM knows in advance.
  let ptr = mem16[SCRIPT_WRITE_PTR]; // 14-row stride-0x20 checksum into a 16-bit accumulator
  let sum = 0;
  for (let row = 0; row < CKSUM_ROWS; row++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + ROW_STRIDE);
  }

  // --- Verify against the stored signature, else spring a tamper trap ----------------------------
  // INTRO_DELAY_CKSUM_WORD (0x8f48) holds a pointer that walks a table of expected checksums, two
  // bytes per column. Compare the accumulator's low byte, then its high byte, against that pair.
  //   - low-byte mismatch  -> tail into dispatchSelfTestState (ROM 0x7442), the checksum-fail landing;
  //   - high-byte mismatch -> tail into runObjectAndEnemyActorUpdate (ROM 0x76ea), the other landing.
  // A clean match on both bytes advances the check pointer past the pair (+2 from where it started),
  // so the next completed column is verified against the next entry in the expected-checksum table.
  let cksum = mem16[INTRO_DELAY_CKSUM_WORD]; // verify against the two stored bytes
  if (mem8[cksum] !== (sum & 0xff)) return dispatchSelfTestState(m); // low-byte miss -> tamper dispatcher
  cksum = u16(cksum + 1);
  if (mem8[cksum] !== (sum >> 8)) return runObjectAndEnemyActorUpdate(m); // high-byte miss -> tamper handler
  mem16[INTRO_DELAY_CKSUM_WORD] = u16(cksum + 1); // clean pass -> advance the check pointer
}
