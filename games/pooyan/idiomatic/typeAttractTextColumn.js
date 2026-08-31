// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { runObjectAndEnemyActorUpdate } from "./runObjectAndEnemyActorUpdate.js";
import { dispatchSelfTestState } from "./dispatchSelfTestState.js";
import {
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  SCRIPT_STEP_COUNTDOWN,
  SCRIPT_READ_PTR,
  SCRIPT_WRITE_PTR,
  ATTRACT_SUBSTATE,
  INTRO_DELAY_CKSUM_WORD,
} from "./names.js";
/**
 * typeAttractTextColumn — attract sub-state 5: the "type one text column" handler.
 *
 * WHAT IT IS
 *   Pooyan's attract/demo screen is driven by a small sub-state machine: ATTRACT_SUBSTATE (0x8e51)
 *   selects one of nine handlers through the attract dispatch table at 0x08a1, and this routine is
 *   entry 5. Its job is to draw the attract-screen title/credit text one vertical column at a time,
 *   painting each column bottom-to-top a single tile per typing tick so the words appear to be
 *   "typed" onto the screen, and then to hand the attract sequence on to its next phase.
 *
 * ROLE IN THE MACHINE
 *   Every frame it keeps the attract picture alive — it ticks the 4-phase background animation and
 *   steps the demo sprite records — and, on a slow cadence, it emits the next character of the
 *   current column from a script held in ROM. Woven into the same routine is an anti-tamper
 *   integrity guard: once a whole column has been laid down it folds the placed tiles into a
 *   checksum and compares that against a reference table in ROM. Because the tiles it just wrote
 *   came straight out of ROM script data, an altered program image yields a wrong column and the
 *   compare fails, diverting the machine onto an integrity path instead of continuing the attract
 *   sequence.
 *
 *   ROM 0x0ac8-0x0b25.  Grounding: [seen].
 *
 * LIVE-OUT (all in memory; the routine returns no value):
 *   - one tile stamped into video RAM through SCRIPT_WRITE_PTR (the next character of the column),
 *     with that write cursor backed up one tile row on every emitted byte;
 *   - SCRIPT_READ_PTR advanced past the script byte just consumed;
 *   - on a completed column: the pacing timers reseeded and ATTRACT_SUBSTATE advanced one phase;
 *   - INTRO_DELAY_CKSUM_WORD advanced past the reference pair on a matching checksum.
 */
const ROW_STRIDE = 0x20; //    the 32-cell video-RAM stride from one tile row to the row directly below it
const CHECKSUM_ROWS = 0x0e; // the 14 rows of a completed column folded into the integrity checksum

export function typeAttractTextColumn(m) {
  const { mem8 } = m;

  // --- Per-frame attract upkeep (runs every frame, before any character is emitted) ---
  // ANIM_FRAME_COUNTER (0x8d41) is the shared attract animation clock. Tick it down; on the tick
  // that reaches zero, advanceAttractAnimationAndRepaint steps the 4-phase background animation and
  // repaints its tile block (that routine also reseeds the counter).
  mem8[ANIM_FRAME_COUNTER]--;
  if (mem8[ANIM_FRAME_COUNTER] === 0) advanceAttractAnimationAndRepaint(m); // reached zero -> advance the 4-phase background animation
  // Whatever the animation clock did, step the four demo sprite records and rebuild the sprite
  // display list so the attract actors keep moving while the text is being typed.
  advanceFourObjectAnimsAndRebuildList(m); // step the demo sprite records + rebuild the sprite display list

  // --- Typing cadence gate ---
  // SCRIPT_FRAME_TIMER (0x8e50) is a per-frame countdown that paces how fast characters appear.
  // Only on the frame it wraps to zero do we emit the next character; on any other frame we stop
  // here. On a typing frame, reseed it to 2 so a fresh character emits every couple of frames.
  mem8[SCRIPT_FRAME_TIMER]--;
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return; // not a typing frame -> nothing further this frame
  mem8[SCRIPT_FRAME_TIMER] = 0x02;

  // --- Emit one character: read a script byte, stamp it into the column, step both cursors ---
  // SCRIPT_READ_PTR (0x8e54) is a 16-bit cursor into the ROM text script. Read the tile code it
  // points at, then advance it one byte so the next typing tick picks up the following character.
  let read = mem8[SCRIPT_READ_PTR] | (mem8[SCRIPT_READ_PTR + 1] << 8);
  const cell = mem8[read];
  read = u16(read + 1);
  mem8[SCRIPT_READ_PTR] = read; // store the advanced read cursor back (low byte, then high byte)
  mem8[SCRIPT_READ_PTR + 1] = read >> 8;
  // SCRIPT_WRITE_PTR (0x8e56) is the 16-bit video-RAM cell this character lands in. Stamp the tile,
  // then move the write cursor UP one tile row (subtract the 0x20 row stride) so the column fills
  // from the bottom upward -- the source of the "typing" look.
  let write = mem8[SCRIPT_WRITE_PTR] | (mem8[SCRIPT_WRITE_PTR + 1] << 8);
  mem8[write] = cell;
  write = u16(write - ROW_STRIDE);
  mem8[SCRIPT_WRITE_PTR] = write; // store the backed-up write cursor back (low byte, then high byte)
  mem8[SCRIPT_WRITE_PTR + 1] = write >> 8;

  // --- Column-complete gate ---
  // SCRIPT_STEP_COUNTDOWN (0x8e52) counts the characters remaining in the current column. Tick it;
  // until it reaches zero the column is still being typed and there is nothing further to do.
  mem8[SCRIPT_STEP_COUNTDOWN]--;
  if (mem8[SCRIPT_STEP_COUNTDOWN] !== 0) return; // column not finished yet
  // The column is complete. Reseed the character counter for the next column (0x0d = 13 characters),
  // hold the typing timer longer before the next column begins (0x14 = 20 frames), and advance the
  // attract sub-state selector (0x8e51 -> next dispatch-table entry) so the sequence steps on.
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d;
  mem8[SCRIPT_FRAME_TIMER] = 0x14;
  mem8[ATTRACT_SUBSTATE]++;

  // --- Integrity checksum of the finished column ---
  // Fold the 14 tile codes of the column just placed into a single 16-bit sum. Start at the current
  // write cursor (which now sits one row above the top of the column) and walk DOWNWARD through the
  // column, adding one tile per row (0x20 stride) with carry into the high byte.
  let ptr = mem8[SCRIPT_WRITE_PTR] | (mem8[SCRIPT_WRITE_PTR + 1] << 8);
  let sum = 0;
  for (let n = 0; n < CHECKSUM_ROWS; n++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + ROW_STRIDE);
  }

  // --- Verify the column against the reference table, or trip the integrity path ---
  // INTRO_DELAY_CKSUM_WORD (0x8f48) points at the next expected-checksum pair in a ROM reference
  // table. Compare the two bytes of the computed sum against that pair. Since the tiles summed were
  // copied out of ROM script data, a matching pair means that stretch of ROM is intact; a mismatch
  // means the program image has been altered, so the machine bails to an integrity handler rather
  // than carry on with the attract screen.
  let ck = mem8[INTRO_DELAY_CKSUM_WORD] | (mem8[INTRO_DELAY_CKSUM_WORD + 1] << 8);
  if (mem8[ck] !== (sum & 0xff)) return dispatchSelfTestState(m); // low byte wrong -> divert to the self-test state dispatcher
  if (mem8[u16(ck + 1)] !== (sum >> 8)) return runObjectAndEnemyActorUpdate(m); // high byte wrong -> divert to the actor-update driver
  // Both bytes matched: step the reference pointer past this pair so the next completed column is
  // checked against the next expected checksum, and store it back.
  ck = u16(ck + 2);
  mem8[INTRO_DELAY_CKSUM_WORD] = ck; // store the advanced reference pointer (low byte, then high byte)
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = ck >> 8;
}
