// SPDX-License-Identifier: GPL-3.0-only
/**
 * decodeDisplayListSlotAndDispatch (ROM 0x2019) -- decode one ready display-list slot and vector it to
 * its draw handler.
 *
 * WHAT IT IS
 *   The command queue is a 32-slot ring on page 0x40 (0x40c0-0x40ff, two bytes per slot): a control
 *   byte then an argument byte. A scanning drain reads the cursor DISPLAY_LIST_CURSOR (0x40a1), and
 *   when it finds a ready slot (control byte's high bit clear) it falls through into this routine. Here
 *   we: take the control byte's low nibble as an even handler index; retire BOTH of the slot's bytes to
 *   0xff (marking the slot free again) while grabbing the second byte as the handler argument; advance
 *   the read cursor two bytes past the slot, wrapping to the list base 0xc0 if it would drop below; store
 *   the advanced cursor; and finally call the selected painter with that argument.
 *
 * ROLE IN THE MACHINE
 *   The dispatch tooth of the per-frame draw pipeline. Producers post (channel<<8 | arg) command words
 *   into the ring; this routine consumes one and paints it. Control bytes are channel numbers 0-7, but
 *   the handler table is keyed 0,2,...,0xe because the ROM doubles the control byte as part of its
 *   ready test, so channel N lands on table entry 2N -- one two-byte pointer per handler in the ROM's
 *   inline jp(hl) word table. An unknown index is a hard error (the queue should only ever hold 0-7).
 *   Every handler returns straight back to the drain loop, so this is a stack-neutral tail-dispatch:
 *   no guest-stack return word is pushed, the handler's own return resumes the scan.
 *
 * ROM 0x2019.  Grounding: [seen] (names.js cert for 0x2019).
 *
 * LIVE-OUT: the two retired slot bytes (0xff), the advanced DISPLAY_LIST_CURSOR, register A (re-seated
 * with the argument), plus whatever the selected handler draws/returns.
 */
import { drawAnimatedTileFigureAtPackedCoord } from "./drawAnimatedTileFigureAtPackedCoord.js";
import { drawFixedTileFigureAtPackedCoord } from "./drawFixedTileFigureAtPackedCoord.js";
import { draw4x4TileForm } from "./draw4x4TileForm.js";
import { addBcdScoreIncrementAndUpdateHighScore } from "./addBcdScoreIncrementAndUpdateHighScore.js";
import { clearAndRedrawScoreField } from "./clearAndRedrawScoreField.js";
import { drawScoreFieldByIndex } from "./drawScoreFieldByIndex.js";
import { renderMessageColumn } from "./renderMessageColumn.js";
import { renderHudFieldBySelector } from "./renderHudFieldBySelector.js";
import { DISPLAY_LIST_CURSOR } from "./names.js";

// The ring occupies 0x40c0-0x40ff (two bytes per slot); the cursor wraps back up to this 0xc0 floor.
const LIST_BASE = 0xc0; // slot list occupies..; the cursor wraps here when it underflows

// The ROM's absorbed jp(hl) word table, keyed by the even handler index (control byte & 0x0f). The eight
// channels: 0/1 tile-figure painters (animated / fixed), 2 the 4x4 indicator form, 3-5 the score
// handlers, 6 the message column, 7 the HUD field.
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
  // Split the slot pointer into page base (0x4000) and low byte; the ring lives at page-0x40 low offsets
  // and the cursor only ever tracks that low byte.
  const page = hl - (hl & 0xff); // slot pointer's page base
  let l = hl & 0xff; // slot pointer low byte

  // Retire the control byte (0xff sets its high bit, marking the slot free for a future producer).
  mem8[page + l] = 0xff; // retire this slot's control byte
  l = (l + 1) & 0xff;
  const arg = mem8[page + l]; // the slot's second byte -> handler argument
  mem8[page + l] = 0xff; // retire it too
  l = (l + 1) & 0xff;

  // Commit the advanced cursor. Both slot bytes are consumed, so it moved +2; clamp up to the 0xc0
  // list base if the +2 carried it below (the ring only spans 0xc0-0xff).
  mem8[DISPLAY_LIST_CURSOR] = l < LIST_BASE ? LIST_BASE : l; // advanced cursor, wrapped to the list base

  const handler = HANDLERS[index];
  if (handler === undefined) {
    // Only channels 0-7 (indices 0,2,..,0xe) are legal; anything else is a corrupt queue -- fail loud.
    throw new Error(`decodeDisplayListSlotAndDispatch: no draw handler for slot index 0x${index.toString(16)}`);
  }
  // Re-seat A with the argument (the ROM's `ld a,e` before jp(hl)) so a register-bridged handler reads
  // it, and pass it explicitly; the direct call returns to the drain loop, no return word pushed.
  return (m.regs.a = arg, handler(m, arg));
}
