// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadBoardObjectRecords — scatter this board's object-init records into two parallel work-RAM
 * attribute arrays.
 *
 * A board-setup helper, run once per board. It selects a per-board table of fixed 5-byte records
 * in program memory, walks it, and de-interleaves each record into one of two destination groups,
 * routed by the record's leading TYPE byte:
 *
 *   - Record layout, 5 bytes: [type, fieldA, fieldB, (byte +3, never read), fieldC].
 *   - TYPE 0 goes to the first group, TYPE 1 to the second. In both cases the three fields land in
 *     three parallel arrays a fixed stride apart, and that group's index advances by one.
 *   - The terminator type ends the walk. IT IS THE ONLY EXIT.
 *   - Any other type is skipped whole and the walk continues.
 *
 * Two small heads run before the walk:
 *   - HEAD A picks the second group's base. It forms an 8-bit modular checksum, seeded with a
 *     fixed value, over six bytes of program data; a checksum of zero selects the base, anything
 *     else selects one byte past it. In the shipped program image those six bytes sum the checksum
 *     to exactly zero, so the alternate base never happens in practice — it is a data-integrity
 *     guard, reproduced here rather than folded away.
 *   - HEAD B picks the record table from BOARD: 25m, 50m and 75m each have their own, and every
 *     other value takes the default.
 *
 * A flat loop that calls nothing.
 *
 * LIVE-OUT: memory-only — the de-interleaved bytes in the two destination arrays.
 */

import { BOARD, OBJ_PARAM_TABLE0, OBJ_PARAM_TABLE1 } from "./names.js";

// HEAD A — the checksum that picks the second group's base.
const CHECKSUM_SEED = 0x5e;
const CHECKSUM_ROM = 0x3f0c; // six bytes of program data, summed mod 256
const CHECKSUM_LEN = 6;

// Per-board record tables (program-data addresses).
const TABLE_BOARD_1 = 0x3ae4;
const TABLE_BOARD_2 = 0x3b5d;
const TABLE_BOARD_3 = 0x3be5;
const TABLE_DEFAULT = 0x3c8b; // 100m, board 0, and anything past the four

// Record shape.
const RECORD_STRIDE = 5; // bytes per record
const FIELD_A = 0x00; // destination offsets within a group
const FIELD_B = 0x15;
const FIELD_C = 0x2a;
const TYPE_IX = 0x00; // route to the first group
const TYPE_IY = 0x01; // route to the second group
const TYPE_END = 0xaa; // terminator

export function loadBoardObjectRecords(m) {
  const { mem } = m;

  // -- HEAD A: 8-bit modular checksum picks the second group's base -------
  let checksum = CHECKSUM_SEED;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    checksum = (checksum + mem.read8((CHECKSUM_ROM + i) & 0xffff)) & 0xff;
  }
  // Zero selects the base, non-zero the byte after it (the data sums to zero, so always the base).
  let iy = checksum === 0 ? OBJ_PARAM_TABLE1 : (OBJ_PARAM_TABLE1 + 1) & 0xffff;

  // -- HEAD B: BOARD picks the record table ------------------------------
  const board = mem.read8(BOARD);
  let hl =
    board === 1 ? TABLE_BOARD_1 :
    board === 2 ? TABLE_BOARD_2 :
    board === 3 ? TABLE_BOARD_3 :
    TABLE_DEFAULT;

  // -- the walk: de-interleave records into the two groups ---------------
  let ix = OBJ_PARAM_TABLE0;
  for (;;) {
    const type = mem.read8(hl);

    if (type === TYPE_IX) {
      hl = (hl + 1) & 0xffff; mem.write8((ix + FIELD_A) & 0xffff, mem.read8(hl));
      hl = (hl + 1) & 0xffff; mem.write8((ix + FIELD_B) & 0xffff, mem.read8(hl));
      hl = (hl + 1) & 0xffff; // record byte +3 is stepped over, never read
      hl = (hl + 1) & 0xffff; mem.write8((ix + FIELD_C) & 0xffff, mem.read8(hl));
      ix = (ix + 1) & 0xffff;
      hl = (hl + 1) & 0xffff; // advance to the next record
      continue;
    }

    if (type === TYPE_IY) {
      hl = (hl + 1) & 0xffff; mem.write8((iy + FIELD_A) & 0xffff, mem.read8(hl));
      hl = (hl + 1) & 0xffff; mem.write8((iy + FIELD_B) & 0xffff, mem.read8(hl));
      hl = (hl + 1) & 0xffff; // record byte +3 stepped over here too
      hl = (hl + 1) & 0xffff; mem.write8((iy + FIELD_C) & 0xffff, mem.read8(hl));
      iy = (iy + 1) & 0xffff;
      hl = (hl + 1) & 0xffff;
      continue;
    }

    if (type === TYPE_END) return; // the only exit

    // Any other type: skip this whole record and keep scanning.
    hl = (hl + RECORD_STRIDE) & 0xffff;
  }
}
