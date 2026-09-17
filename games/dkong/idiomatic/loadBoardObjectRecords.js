// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadBoardObjectRecords — scatter this board's object-init records into two
 * parallel work-RAM attribute arrays, run once per board.
 *
 * Two heads run first: a modular checksum picks the second group's base, and
 * BOARD picks the per-board record table. The walk then de-interleaves each
 * fixed 5-byte record into one of two groups by its leading type byte, until
 * the terminator type ends it.
 *
 * LIVE-OUT: memory-only — the de-interleaved bytes in the two destination arrays.
 */

import { BOARD, OBJ_PARAM_TABLE0, OBJ_PARAM_TABLE1 } from "./names.js";

const CHECKSUM_SEED = 0x5e;
const CHECKSUM_ROM = 0x3f0c; // six bytes of program data, summed mod 256
const CHECKSUM_LEN = 6;

const TABLE_BOARD_1 = 0x3ae4;
const TABLE_BOARD_2 = 0x3b5d;
const TABLE_BOARD_3 = 0x3be5;
const TABLE_DEFAULT = 0x3c8b; // 100m, board 0, and anything past the four

const RECORD_STRIDE = 5; // bytes per record
const FIELD_A = 0x00; // destination offsets within a group
const FIELD_B = 0x15;
const FIELD_C = 0x2a;
const TYPE_IX = 0x00; // route to the first group
const TYPE_IY = 0x01; // route to the second group
const TYPE_END = 0xaa; // terminator

export function loadBoardObjectRecords(m) {
  const { mem8 } = m;

  let checksum = CHECKSUM_SEED;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    checksum = (checksum + mem8[(CHECKSUM_ROM + i) & 0xffff]) & 0xff;
  }
  let iy = checksum === 0 ? OBJ_PARAM_TABLE1 : (OBJ_PARAM_TABLE1 + 1) & 0xffff;

  const board = mem8[BOARD];
  let hl =
    board === 1 ? TABLE_BOARD_1 :
    board === 2 ? TABLE_BOARD_2 :
    board === 3 ? TABLE_BOARD_3 :
    TABLE_DEFAULT;

  let ix = OBJ_PARAM_TABLE0;
  for (;;) {
    const type = mem8[hl];

    if (type === TYPE_IX) {
      hl = (hl + 1) & 0xffff; mem8[(ix + FIELD_A) & 0xffff] = mem8[hl];
      hl = (hl + 1) & 0xffff; mem8[(ix + FIELD_B) & 0xffff] = mem8[hl];
      hl = (hl + 1) & 0xffff; // record byte +3 is stepped over, never read
      hl = (hl + 1) & 0xffff; mem8[(ix + FIELD_C) & 0xffff] = mem8[hl];
      ix = (ix + 1) & 0xffff;
      hl = (hl + 1) & 0xffff; // advance to the next record
      continue;
    }

    if (type === TYPE_IY) {
      hl = (hl + 1) & 0xffff; mem8[(iy + FIELD_A) & 0xffff] = mem8[hl];
      hl = (hl + 1) & 0xffff; mem8[(iy + FIELD_B) & 0xffff] = mem8[hl];
      hl = (hl + 1) & 0xffff; // record byte +3 stepped over here too
      hl = (hl + 1) & 0xffff; mem8[(iy + FIELD_C) & 0xffff] = mem8[hl];
      iy = (iy + 1) & 0xffff;
      hl = (hl + 1) & 0xffff;
      continue;
    }

    if (type === TYPE_END) return; // the only exit

    hl = (hl + RECORD_STRIDE) & 0xffff;
  }
}
