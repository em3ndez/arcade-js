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

import { u16 } from "../../../core/int.js";
import {
  BOARD,
  BOARD_LAYOUT_TABLE_25M,
  BOARD_LAYOUT_TABLE_50M,
  BOARD_LAYOUT_TABLE_75M,
  BOARD_LAYOUT_TABLE_RIVET,
  BOARD_RECORD_CHECKSUM_ROM,
  OBJ_PARAM_TABLE0,
  OBJ_PARAM_TABLE1,
} from "./names.js";

const CHECKSUM_SEED = 0x5e;
const CHECKSUM_LEN = 6;


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
    checksum = (checksum + mem8[u16(BOARD_RECORD_CHECKSUM_ROM + i)]) & 0xff;
  }
  let iy = checksum === 0 ? OBJ_PARAM_TABLE1 : u16(OBJ_PARAM_TABLE1 + 1);

  const board = mem8[BOARD];
  let hl =
    board === 1 ? BOARD_LAYOUT_TABLE_25M :
    board === 2 ? BOARD_LAYOUT_TABLE_50M :
    board === 3 ? BOARD_LAYOUT_TABLE_75M :
    BOARD_LAYOUT_TABLE_RIVET;

  let ix = OBJ_PARAM_TABLE0;
  for (;;) {
    const type = mem8[hl];

    if (type === TYPE_IX) {
      hl = u16(hl + 1); mem8[u16(ix + FIELD_A)] = mem8[hl];
      hl = u16(hl + 1); mem8[u16(ix + FIELD_B)] = mem8[hl];
      hl = u16(hl + 1); // record byte +3 is stepped over, never read
      hl = u16(hl + 1); mem8[u16(ix + FIELD_C)] = mem8[hl];
      ix = u16(ix + 1);
      hl = u16(hl + 1); // advance to the next record
      continue;
    }

    if (type === TYPE_IY) {
      hl = u16(hl + 1); mem8[u16(iy + FIELD_A)] = mem8[hl];
      hl = u16(hl + 1); mem8[u16(iy + FIELD_B)] = mem8[hl];
      hl = u16(hl + 1); // record byte +3 stepped over here too
      hl = u16(hl + 1); mem8[u16(iy + FIELD_C)] = mem8[hl];
      iy = u16(iy + 1);
      hl = u16(hl + 1);
      continue;
    }

    if (type === TYPE_END) return; // the only exit

    hl = u16(hl + RECORD_STRIDE);
  }
}
