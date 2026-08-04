// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_34b9 — seed an object record's paired position fields from one of two template tables;
 * skipped entirely on board 3.
 *
 * A table initialiser for whichever object record the caller points at. On board 3 it returns at
 * once and writes nothing. Otherwise it picks one of two template tables by bit 7 of MARIO_X —
 * Mario's screen half — and indexes the chosen table by the spin counter's bits 1 and 2, giving a
 * 2-byte-aligned entry at 0, 2, 4 or 6. Each table holds four such two-byte entries.
 *
 * The selected entry's two bytes are stamped into paired record fields:
 *   • the first byte into the X field AND its companion four fields further on;
 *   • the second byte into the Y field AND its own companion beside that.
 * Then three record bytes are cleared: the object state and the two trailing fields.
 *
 * The object-record pointer arrives in a register rather than as a parameter.
 *
 * NOT CLAIMED: which game object this seeds, or what the two paired companion fields and the two
 * cleared trailing fields mean. What is pinned is the mechanism — a per-record template stamp,
 * gated on the board and selected by Mario's screen half.
 *
 * LIVE-OUT: memory-only — the seeded and cleared record fields.
 */

import { BOARD, MARIO_X, SPIN_COUNT, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";

// The two template tables in program memory, four 2-byte entries each. Bit 7 of MARIO_X picks one.
const TABLE_BIT7_CLEAR = 0x3ac4;
const TABLE_BIT7_SET = 0x3ad4;

// Record fields that carry no shared name.
const OBJ_X_COMPANION = 0x0e; // gets the same byte as OBJ_X
const OBJ_Y_COMPANION = 0x0f; // gets the same byte as OBJ_Y
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

  // The caller's object-record pointer, handed over in a register.
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
