// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_34b9 — seed an object record's paired position fields from one of two ROM
 * template tables (skipped on board 3).  ROM 0x34B9.
 *
 * A table initialiser for the object record the caller points at (IX live-in). It
 * does nothing on board 3 (BOARD == 3 returns at once). Otherwise it picks one of
 * two ROM template tables by bit 7 of MARIO_X — set selects the 0x3AD4 table, clear
 * selects the 0x3AC4 table — and indexes the chosen table by (SPIN_COUNT & 6), a
 * 2-byte-aligned entry {0,2,4,6}. Each table holds four such two-byte entries.
 *
 * The selected entry's two bytes are stamped into paired record fields:
 *   • the first byte into the X field (+0x03) AND its companion at +0x0e;
 *   • the second byte into the Y field (+0x05) AND its companion at +0x0f.
 * Then three record bytes are cleared to zero: the object state (+0x0d) and the two
 * fields at +0x18 and +0x1c.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle (a per-record
 * template stamp gated on board and selected by Mario's screen-half bit), but which
 * game object this seeds, and what the paired +0x0e/+0x0f and cleared +0x18/+0x1c
 * fields mean, is not corroborated to the routine-name bar. Promote once grounded.
 *
 * The object-record pointer arrives in a register because the sole caller (sub_32bd,
 * ROM 0x32CA) is still the frozen oracle and hands it over that way; this reads it
 * from the machine rather than as a promoted parameter. That dissolves once the
 * caller is decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-34b9.test.js.
 * GATE:     crafted-entry (exhaustive over the logic) — the whole memory effect is a
 *           function of BOARD (==3 skip), MARIO_X bit 7 (table select), and
 *           SPIN_COUNT & 6 (entry index); every one of those 2×2×4 combos is swept
 *           over two distinct record bases on a real attract-base machine, both sides
 *           reading the same ROM tables. 0x34B9 is a non-executing frontier in
 *           attract (the sub_32bd path is not taken), which the test confirms and
 *           reports; any natural dispatch that does occur is replayed. Teeth: an
 *           inverted table select, a wrong index mask, and a dropped field clear.
 * LIVE-OUT: memory-only — the caller consumes only the seeded record fields; the
 *           oracle's residual registers/flags and its terminal return are dead ABI.
 * NAMES:    BOARD (0x6227), MARIO_X (0x6203), SPIN_COUNT (0x6019), and the record
 *           offsets OBJ_X (+0x03), OBJ_Y (+0x05), OBJ_STATE (+0x0d) — all from names.js.
 *           The ROM template tables (0x3AC4 / 0x3AD4) and the paired/cleared record
 *           fields (+0x0e, +0x0f, +0x18, +0x1c) have no names.js name and stay local
 *           consts here.
 */

import { BOARD, MARIO_X, SPIN_COUNT, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";

// The two ROM template tables (four 2-byte entries each). Bit 7 of MARIO_X picks one.
const TABLE_BIT7_CLEAR = 0x3ac4;
const TABLE_BIT7_SET = 0x3ad4;

// Record fields with no shared OBJ_* offset name in names.js yet.
const OBJ_X_COMPANION = 0x0e; // gets the same byte as OBJ_X (+0x03)
const OBJ_Y_COMPANION = 0x0f; // gets the same byte as OBJ_Y (+0x05)
const OBJ_CLEAR_18 = 0x18;    // cleared to zero
const OBJ_CLEAR_1C = 0x1c;    // cleared to zero

export function loc_34b9(m) {
  const { regs, mem } = m;

  // Board 3: nothing to seed.
  if (mem.read8(BOARD) === 0x03) return;

  // Pick the template table by Mario's screen-half bit, then the 2-byte entry index.
  const table = (mem.read8(MARIO_X) & 0x80) !== 0 ? TABLE_BIT7_SET : TABLE_BIT7_CLEAR;
  const entry = table + (mem.read8(SPIN_COUNT) & 0x06);
  const posX = mem.read8(entry);
  const posY = mem.read8(entry + 1);

  // The caller's object-record pointer (oracle boundary: sub_32bd still supplies it).
  const objBase = regs.ix;

  // Stamp the entry's two bytes into their paired fields.
  mem.write8((objBase + OBJ_X) & 0xffff, posX);
  mem.write8((objBase + OBJ_X_COMPANION) & 0xffff, posX);
  mem.write8((objBase + OBJ_Y) & 0xffff, posY);
  mem.write8((objBase + OBJ_Y_COMPANION) & 0xffff, posY);

  // Clear the state byte and the two trailing fields.
  mem.write8((objBase + OBJ_STATE) & 0xffff, 0x00);
  mem.write8((objBase + OBJ_CLEAR_18) & 0xffff, 0x00);
  mem.write8((objBase + OBJ_CLEAR_1C) & 0xffff, 0x00);
}
