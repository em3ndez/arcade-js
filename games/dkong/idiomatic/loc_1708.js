// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1708 — board/intro spawn init: silence sound, seed a fixed 4-byte sprite
 * record plus the blink-sprite code, paint a 3-cell descending colour column, then
 * set the sound-priority pair.  ROM 0x1708.
 *
 * A straight-line, INPUT-INDEPENDENT initializer: it reads no memory and takes no
 * arguments — every store is a constant, so its effect on the compared state is the
 * same regardless of the machine state it is entered with. In order:
 *
 *   1. silenceSound (ROM 0x011c) — zero every sound output and its work-RAM shadow
 *      (0x6080-0x608B), a clean audio slate before the priority write below.
 *   2. Seed the 4-byte sprite record at 0x6A20 (inside SPRITE_BUFFER 0x6900-0x6A7F)
 *      to the constants 0x80/0x76/0x09/0x20 — the sprite-record [X, code, attr, Y]
 *      field order observed for MARIO_SPRITE_RECORD; loc_18c6 later animates this
 *      same record (code 0x76, attr 0x09) during the 0x6388 intro sequence.
 *   3. Seed the blink-sprite code at 0x6905 (sprite-buffer record 1, +1 byte) to
 *      0x13 — the byte whose bit 7 the attract/intro colour cycle toggles to blink
 *      it (loc_04a3/loc_04ac/loc_04e1/loc_04f9 read and flip 0x6905).
 *   4. fillDescendingColumn (ROM 0x0514) — paint a 3-cell descending colour column
 *      into colour RAM from 0x75C4, stride 0x20 (one tilemap row), start value 0x10,
 *      laying 0x10 / 0x0F / 0x0E down the cells 0x75C4 / 0x75E4 / 0x7604.
 *   5. Set the sound-priority pair SND_PRIORITY / SND_PRIORITY_FRAMES (0x608A/0x608B)
 *      to 0x07 / 0x03 — re-written after silenceSound zeroed them.
 *
 * Called at board load (loc_16a3) and the intro-cutscene spawn (sub_1654); both
 * callers label it "spawn". The neutral loc_1708 name reflects that the individual
 * writes are understood but the routine's single unifying role is not confirmed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1708.test.js.
 * GATE:     crafted-entry — INPUT-INDEPENDENT and straight-line (reads no memory,
 *           takes no args; every store is a constant, so there is no data-dependent
 *           branch and no unreached arm). It is NOT on the attract or coin+start path
 *           exercised here (its callers loc_16a3 board-load and sub_1654 intro-spawn
 *           are not reached by those tapes), so it is validated on real captured
 *           ATTRACT states used as entries — valid because the routine is proven
 *           input-independent — PLUS crafted pre-dirtied entries proving it overwrites
 *           prior contents. Teeth: a wrong sprite byte and a skipped colour column.
 * LIVE-OUT: memory-only — both callers reload A/HL/DE/BC before use and consume no
 *           register or flag this leaves (loc_16a3 `ld a,(0x6910)`; sub_1654
 *           `ld hl,0x385c`). SP/PC are not compared — the direct-call layer replaces
 *           the oracle's push16/ret stack+PC bookkeeping with the JS call stack. The
 *           three sound-hardware latches silenceSound issues (0x7D00-07, 0x7D80,
 *           0x7C00) are write-only io outputs, not in the RAM dump.
 * NAMES:    SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B) from ram.js. The
 *           sprite-buffer bytes 0x6A20-0x6A23, the blink code 0x6905, and the colour
 *           column start 0x75C4 have no ram.js symbol and stay local hex constants.
 */

import { SND_PRIORITY, SND_PRIORITY_FRAMES } from "./ram.js";
import { silenceSound } from "./silenceSound.js"; // ROM 0x011c
import { fillDescendingColumn } from "./fillDescendingColumn.js"; // ROM 0x0514

// A 4-byte sprite record inside SPRITE_BUFFER (0x6900-0x6A7F); no ram.js symbol.
const SPRITE_RECORD_6A20 = 0x6a20;
// Sprite-buffer record 1, +1 byte — the blink-sprite code the colour cycle toggles.
const BLINK_SPRITE_CODE = 0x6905;
// Colour-RAM column start for the 3-cell descending fill (via fillDescendingColumn).
const COLOUR_COLUMN = 0x75c4;

export function loc_1708(m) {
  const { regs, mem } = m;

  // 1. Silence every sound output (and its work-RAM shadow 0x6080-0x608B).
  silenceSound(m); // ROM 0x011c

  // 2. Seed the fixed 4-byte sprite record at 0x6A20: [X, code, attr, Y].
  mem.write8(SPRITE_RECORD_6A20 + 0, 0x80);
  mem.write8(SPRITE_RECORD_6A20 + 1, 0x76);
  mem.write8(SPRITE_RECORD_6A20 + 2, 0x09);
  mem.write8(SPRITE_RECORD_6A20 + 3, 0x20);

  // 3. Seed the blink-sprite code at 0x6905.
  mem.write8(BLINK_SPRITE_CODE, 0x13);

  // 4. Paint the 3-cell descending colour column from 0x75C4 (stride 0x20, start
  //    0x10 -> 0x10/0x0F/0x0E). fillDescendingColumn takes HL/A/DE as register live-in.
  regs.hl = COLOUR_COLUMN; // ld hl,0x75c4
  regs.de = 0x0020; //        ld de,0x0020
  regs.a = 0x10; //           ld a,0x10
  fillDescendingColumn(m); // ROM 0x0514

  // 5. Set the sound-priority pair (silenceSound just zeroed both).
  mem.write8(SND_PRIORITY, 0x07); //        0x608A
  mem.write8(SND_PRIORITY_FRAMES, 0x03); // 0x608B
}
