// SPDX-License-Identifier: GPL-3.0-only
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { typeDrawScriptRecord } from "./typeDrawScriptRecord.js";
import { u16 } from "../../../core/int.js";

/**
 * typeDrawScript — walk a draw script, typing each record onto the screen until the terminator.
 *
 * WHAT IT IS
 *   Drives one attract-screen "typewriter" pass: it reads a table of four-byte draw records and types
 *   each one out (glyphs appearing a few frames apart) until it hits the 0xff end marker. This is how
 *   the attract screens lay down their multi-line text with the characteristic typed cadence.
 *
 * ROLE IN THE MACHINE
 *   Reached from drawScoreAdvanceTable / typeSecondDrawScript (the score-advance attract table; see
 *   mechanisms.md "Attract screen and status display"). Each record is fetched by fetchNextDrawRecord
 *   (0x1856), which unpacks two little-endian words — a screen address (dest) and a graphics pointer
 *   (source) — and flags carry on the 0xff terminator; here the terminator is instead tested directly
 *   off the script pointer before each fetch. typeDrawScriptRecord (0x184c) types one record's glyphs
 *   paced by TYPE_PACE_COUNT. In the 8080 the script cursor is BC; the idiomatic port keeps it as a JS
 *   local (`ptr`) advanced four bytes per record.
 *
 * ROM 0x183a-0x1843.  Grounding: [seen] (names.js cert).
 *
 * Generator (yield* forwards each record's paced typing); memory-only.
 */
export function* typeDrawScript(m, bc) {
  // Script cursor: a JS local rather than the register pair (the ROM walks it in BC).
  let ptr = bc;
  for (;;) {
    // 0xff at the cursor ends the script.
    if (m.mem8[ptr] === 0xff) return;
    // Pull the next 4-byte record (rec[0] = dest screen address, rec[1] = source graphics pointer),
    // step the cursor past all four bytes, then type that record's glyphs at the paced cadence.
    const rec = fetchNextDrawRecord(m, ptr); // rec[0] = dest, rec[1] = source
    ptr = u16(ptr + 4);
    yield* typeDrawScriptRecord(m, rec[1], rec[0]);
  }
}
