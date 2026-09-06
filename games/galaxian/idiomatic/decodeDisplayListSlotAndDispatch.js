// SPDX-License-Identifier: GPL-3.0-only
// (; absorbs ): decode one ready display-list slot and dispatch its
// draw handler. The control byte's low nibble selects an even handler index; both bytes of the slot are
// retired to 0xff and the read cursor advances past them, wrapping to the list base (0xc0) when it drops
// below. The advanced cursor is stored, then the slot's second byte -- the handler argument -- is handed to
// the selected painter. The 's inline word table at and its `push; jp (hl)` tail-dispatch
// are absorbed into the table below: each handler is called directly and returns straight to the dispatch
// loop, so no guest-stack return word is pushed (a stack-neutral tail-dispatch -- see the eq test's seam
// tooth). dissolves here; this fall-through is its only caller.
import { drawAnimatedTileFigureAtPackedCoord } from "./drawAnimatedTileFigureAtPackedCoord.js";
import { drawFixedTileFigureAtPackedCoord } from "./drawFixedTileFigureAtPackedCoord.js";
import { draw4x4TileForm } from "./draw4x4TileForm.js";
import { addBcdScoreIncrementAndUpdateHighScore } from "./addBcdScoreIncrementAndUpdateHighScore.js";
import { clearAndRedrawScoreField } from "./clearAndRedrawScoreField.js";
import { drawScoreFieldByIndex } from "./drawScoreFieldByIndex.js";
import { renderMessageColumn } from "./renderMessageColumn.js";
import { renderHudFieldBySelector } from "./renderHudFieldBySelector.js";
import { DISPLAY_LIST_CURSOR } from "./names.js";

const LIST_BASE = 0xc0; // slot list occupies..; the cursor wraps here when it underflows

// The absorbed jp(hl) word table at, keyed by the even handler index (control byte & 0x0f).
const HANDLERS = {
  0x0: drawAnimatedTileFigureAtPackedCoord,
  0x2: drawFixedTileFigureAtPackedCoord,
  0x4: draw4x4TileForm,
  0x6: addBcdScoreIncrementAndUpdateHighScore,
  0x8: clearAndRedrawScoreField,
  0xa: drawScoreFieldByIndex,
  0xc: renderMessageColumn,
  0xe: renderHudFieldBySelector,
};

export function decodeDisplayListSlotAndDispatch(m, ctrl = m.regs.a, hl = m.regs.hl) {
  const { mem8 } = m;

  const index = ctrl & 0x0f; // control low nibble -> even handler index 0,2,..,e
  const page = hl - (hl & 0xff); // slot pointer's page base
  let l = hl & 0xff; // slot pointer low byte

  mem8[page + l] = 0xff; // retire this slot's control byte
  l = (l + 1) & 0xff;
  const arg = mem8[page + l]; // the slot's second byte -> handler argument
  mem8[page + l] = 0xff; // retire it too
  l = (l + 1) & 0xff;

  mem8[DISPLAY_LIST_CURSOR] = l < LIST_BASE ? LIST_BASE : l; // advanced cursor, wrapped to the list base

  const handler = HANDLERS[index];
  if (handler === undefined) {
    throw new Error(`decodeDisplayListSlotAndDispatch: no draw handler for slot index 0x${index.toString(16)}`);
  }
  // Re-seat A with the argument (the 's `ld a,e` before jp(hl)) so a register-bridged handler reads it,
  // and pass it explicitly; the direct call returns to the dispatch loop, no return word pushed.
  return (m.regs.a = arg, handler(m, arg));
}
