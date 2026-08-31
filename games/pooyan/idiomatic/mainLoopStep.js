// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { DISPLAY_CMD_RING_READ_PTR } from "./names.js";
import { repaintScrollColumnsElseVerifySignature } from "./repaintScrollColumnsElseVerifySignature.js";
import { paintActorCountColumn } from "./paintActorCountColumn.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { paintAttractHudAndHighScores } from "./paintAttractHudAndHighScores.js";
import { accrueScoreAndUpdateHighScore } from "./accrueScoreAndUpdateHighScore.js";
import { resetBcdCounterAndRepaintColumn } from "./resetBcdCounterAndRepaintColumn.js";
import { drawBcdCounterColumn } from "./drawBcdCounterColumn.js";
import { drawStackedCharField } from "./drawStackedCharField.js";
import { drawCreditCountAndTamperCheck } from "./drawCreditCountAndTamperCheck.js";
import { flagHighScoreTableCorruptOnChecksumMiss } from "./flagHighScoreTableCorruptOnChecksumMiss.js";

// The display-command ring is a 64-byte circular buffer of two-byte commands living on page 0x88
// (slots 0x88c0..0x88ff), one cell above the ring-cursor band. The read cursor is stored as a bare
// low byte (0x88a1); to turn that low byte into a full slot address we OR in the ring's page. Since
// DISPLAY_CMD_RING_READ_PTR is 0x88a1, masking off its low byte leaves 0x8800 -- the ring's page.
const RING_PAGE = DISPLAY_CMD_RING_READ_PTR & ~0xff; // the ring lives on the cursor's page
// The ring occupies the top of the page, 0xc0..0xff. As the cursor steps forward two bytes at a
// time it eventually passes the end of the page (its low byte would carry past 0xff); when it does,
// it snaps back to the ring base 0xc0 rather than wandering below the ring into the cursor band.
const RING_WRAP = 0xc0; //                              cursor low wraps back to the ring base here

/**
 * mainLoopStep — one iteration of the main-loop state driver. Reads the
 * display-command ring at its read cursor: a worker slot (bit 7 set) runs the per-frame worker and
 * marks the vblank boundary; any other slot consumes one two-byte command, advances and wraps the
 * cursor, and runs the command's handler from the dispatch table.
 *
 * WHAT IT IS: the game's foreground/background thread. It spins continuously, interrupted (not
 * driven) by the vblank, and its sole job is to drain the display-command ring -- the queue every
 * other part of the machine posts drawing work into. One call here is one turn of that loop.
 *
 * ROLE IN THE MACHINE: the display-command driver. Producers elsewhere enqueue two-byte commands
 * (a command selector plus a parameter) into the ring; this loop pulls them off the read cursor and
 * runs each command's handler. It keeps consuming commands back-to-back -- an entire queued backlog
 * drains within a single frame, not one command per frame -- until it reaches the "worker marker"
 * slot (bit 7 set), which is the ring-idle point: the natural once-per-frame boundary at which it
 * runs the per-frame scroll worker. Draining the whole backlog per frame matters: if only one
 * command ran per frame, a queue built up on the credit screen would leak stale tiles onto the
 * playfield.
 *
 * ROM 0x020F-0x0241. Grounding: [seen].
 *
 * LIVE-OUT: on a command dispatch it advances DISPLAY_CMD_RING_READ_PTR (0x88a1) past the two
 * bytes it consumed and frees those two ring slots (0xff written back into both), then the handler
 * it dispatched leaves its own effects (HUD/panel tiles, score cells, integrity flags). On a worker
 * iteration it advances nothing and leaves only the worker's effects. The boolean return marks the
 * two cases for the caller.
 *
 * Returns true on the worker/ring-idle iteration (the vblank boundary), false on a command dispatch
 * (the loop keeps draining the ring within the frame).
 */
export function mainLoopStep(m) {
  const { mem8 } = m;
  // Read the ring at the read cursor: fetch the cursor's low byte (0x88a1), compose the full slot
  // address on the ring's page, and read the slot byte there. That byte is either a worker marker
  // (bit 7 set) or a display-command selector.
  const cursorLo = mem8[DISPLAY_CMD_RING_READ_PTR];
  const slotAddr = RING_PAGE | cursorLo;
  const slot = mem8[slotAddr];

  // Worker marker: bit 7 set means "run the per-frame worker, then treat that as the frame beat."
  // This is the ring-idle point, hit once per pass through the queue. The worker itself repaints the
  // scrolling side columns (or, on the other 15 frames of every 16, runs the ROM-signature anti-
  // tamper check). The cursor is NOT advanced and the slot is NOT freed -- the worker marker stays
  // in place as the perpetual end-of-queue sentinel. Returning true tells the caller this was the
  // vblank boundary.
  if (slot & 0x80) {
    repaintScrollColumnsElseVerifySignature(m); // worker slot -> the real vblank boundary
    return true;
  }

  // Ordinary two-byte command. The command selector is doubled and masked to an even offset within
  // the ring page (0..0x1e), which is exactly the even entry offset into the ROM handler table --
  // one handler per two-byte table entry. The parameter is the second byte of the command pair, at
  // the slot's next address (u16-wrapped inside the page).
  const index = u8(slot << 1) & 0x1f; // (command * 2) & 0x1f -> the even dispatch-table offset
  const param = mem8[u16(slotAddr + 1)];
  // Free both consumed ring bytes by stamping the empty marker (0xff) back into them, so the slot is
  // available for a future producer and is not re-dispatched on the next pass.
  mem8[slotAddr] = 0xff; //             free both consumed ring bytes
  mem8[u16(slotAddr + 1)] = 0xff;
  // Advance the read cursor by the two bytes just consumed. If that carries the low byte to or past
  // the end of the ring page, wrap it back to the ring base (0xc0) rather than stepping below the
  // ring into the cursor band; otherwise keep the advanced value. Only the low byte is stored -- the
  // page is implicit.
  const advanced = u8(cursorLo + 2); // two bytes consumed
  mem8[DISPLAY_CMD_RING_READ_PTR] = advanced >= RING_WRAP ? advanced : RING_WRAP;

  // Dispatch the command to its handler by the even table offset. The nine entries cover the panel/
  // HUD painters, the score/credit renders, and the high-score-table integrity check. Handlers that
  // need the command's second byte take it as param.
  switch (index) {
    case 0x00: paintActorCountColumn(m); break; //                           paint the actor-count column
    case 0x02: renderPhaseGauge(m); break; //                                repaint the vertical phase gauge
    case 0x04: paintAttractHudAndHighScores(m); break; //                    repaint the attract HUD + high-score table
    case 0x06: accrueScoreAndUpdateHighScore(m, param); break; //            add to the active score, keep the high score in step
    case 0x08: resetBcdCounterAndRepaintColumn(m, param); break; //          reset one BCD counter and repaint its column
    case 0x0a: drawBcdCounterColumn(m, param); break; //                     redraw one packed-BCD counter down its column
    case 0x0c: drawStackedCharField(m, param); break; //                     draw a table-selected stacked-character field
    case 0x0e: drawCreditCountAndTamperCheck(m); break; //                   draw the credit digits + a ROM-checksum tripwire
    case 0x10: flagHighScoreTableCorruptOnChecksumMiss(m); break; //         flag a corrupt high-score table on a checksum miss
  }
  // A command dispatch is not the frame beat: return false so the caller keeps draining the ring
  // within this frame until the worker marker is reached.
  return false;
}
