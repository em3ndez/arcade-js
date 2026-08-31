// SPDX-License-Identifier: GPL-3.0-only
import { DISPLAY_MSG_BUF, ROUND_INIT_MSG_TABLE } from "./names.js";
import { fillByteRun } from "./fillByteRun.js";
import { selectRoundDisplayListAndAdvancePhase } from "./selectRoundDisplayListAndAdvancePhase.js";
/**
 * clearDisplayMsgBufOnRoundInitMatch — compare the terminated pattern against the display message buffer.
 *
 * WHAT IT IS
 * ----------
 * ROM 0x1694. Grounding: [seen].
 *
 * A tiny classify-then-act routine that sits at the front of the play-round idx1 handler. The
 * machine keeps a small on-screen text region — the display message buffer, a run of seven tile
 * cells based at DISPLAY_MSG_BUF (0x89f0). During round setup various routines copy a ROM string
 * or table into that buffer to show a message on the playfield. This routine's job is to decide,
 * on each entry, whether the buffer currently holds the specific "round-init" message and, if so,
 * to wipe it clean so the field returns to blank tiles.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * It is the gate that fronts the idx1 play sub-state. It compares the seven-cell buffer against a
 * fixed 0xff-terminated pattern held in ROM at ROUND_INIT_MSG_TABLE (0x16ae):
 *
 *   - If every byte up to the terminator matches, the buffer is the round-init message that has
 *     served its purpose, so the seven cells are blanked to zero and the routine returns. Nothing
 *     downstream runs this frame — the buffer has just been retired.
 *
 *   - If any byte differs before the terminator, the buffer holds something else (an unfinished or
 *     unrelated message), so control continues straight on into the idx1 state handler
 *     selectRoundDisplayListAndAdvancePhase (ROM 0x16b7). This is a tail-branch: the machine jumps
 *     rather than calling, so that handler runs in this routine's stack frame and its return goes
 *     directly back to the original caller.
 *
 * LIVE-OUT: memory only — either the seven buffer cells at 0x89f0 zeroed, or (on the mismatch
 * path) whatever selectRoundDisplayListAndAdvancePhase leaves behind. No register survives for a
 * caller to read back.
 */

const FIELD_LEN = 0x07; // cells cleared on a full match

export function clearDisplayMsgBufOnRoundInitMatch(m) {
  const { mem8 } = m;

  // Two walking cursors: `src` steps through the fixed compare pattern in ROM starting at
  // ROUND_INIT_MSG_TABLE (0x16ae), and `dst` steps through the live seven-cell buffer in RAM
  // starting at DISPLAY_MSG_BUF (0x89f0). They advance in lockstep, one buffer cell per pattern
  // byte, so byte N of the pattern is checked against cell N of the buffer.
  let src = ROUND_INIT_MSG_TABLE;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    // Read the next pattern byte from ROM. The pattern is 0xff-terminated: an 0xff is not a tile
    // code but the end marker. Reaching it means every preceding byte matched, i.e. the buffer is
    // exactly the round-init message — a full match. Break out to the clear.
    const a = mem8[src];
    if (a === 0xff) break; // terminator: full match
    // Otherwise compare this pattern byte against the corresponding buffer cell. The first byte
    // that differs proves the buffer is NOT the round-init message, so abandon the compare and
    // hand off to the idx1 state handler in this same frame (its return becomes ours).
    if (a !== mem8[dst]) return selectRoundDisplayListAndAdvancePhase(m); // mismatch: tail into the state handler
    // Bytes matched so far — advance both cursors and test the next cell.
    src++;
    dst++;
  }

  // Full match: the round-init message is on screen and has done its job. Blank all seven cells of
  // the display message buffer by writing the clear tile 0x00 across FIELD_LEN (7) bytes from
  // DISPLAY_MSG_BUF, retiring the message and returning the region to empty.
  fillByteRun(m, DISPLAY_MSG_BUF, 0x00, FIELD_LEN);
}
