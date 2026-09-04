// SPDX-License-Identifier: GPL-3.0-only
import { activeFieldRecordPointer } from "./activeFieldRecordPointer.js";
import { loc_2008, loc_2009 } from "./names.js";

/**
 * stageActivePlayerFieldSave — load the fleet state and aim HL at the active player's save slot.
 *
 * WHAT IT IS
 *   Prepares to write the active player's alien-field state back into its per-player record. It loads a
 *   count byte from loc_2008 into B, loads the 16-bit reference-alien coordinate word from loc_2009
 *   into DE, and builds HL = the field-save record pointer via activeFieldRecordPointer — so the caller
 *   has the values (B, DE) and the destination (HL) staged for the write.
 *
 * ROLE IN THE MACHINE
 *   Reached during the player-switch path (called from 0x02f8, i.e. newRoundFlow's field-stash step):
 *   the outgoing player's field is stashed before the incoming player's is restored. activeFieldRecordPointer
 *   forms (ACTIVE_PLAYER_PAGE << 8) | 0xfc, the field-save record near the top of the current player's
 *   page. loc_2008 is the working alien count and loc_2009/loc_200a are the reference-alien coordinate
 *   anchor that loadReferenceAlienState mirrors out of that same record — this is the save side of that
 *   load. loc_2008/loc_2009 keep loc_ names because the pixel-axis convention is not confidently read.
 *
 * ROM 0x0878-0x0882.  Grounding: [code] (role read from the body; MAME grounding still open — one of
 * the two remaining [code] items in this game).
 * LIVE-OUT: B = count [loc_2008], DE = coordinate word [loc_2009], HL = the page:0xfc save-record pointer.
 */
// Seat the record count and its source pointer, then build the active player's record pointer.
export function stageActivePlayerFieldSave(m) {
  // Working alien count from loc_2008 -> B (the ROM `lda 0x2008` / `mov b,a`).
  const b = m.mem8[loc_2008];
  // Reference-alien coordinate word from loc_2009 -> DE (the ROM `lhld 0x2009` / `xchg`).
  const de = m.mem16[loc_2009];
  // Build HL = (page<<8)|0xfc save slot, and publish the staged B and DE registers for the writer.
  return [activeFieldRecordPointer(m), m.regs.b = b, m.regs.de = de];
}
