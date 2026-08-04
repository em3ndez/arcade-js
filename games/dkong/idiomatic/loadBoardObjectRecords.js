// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadBoardObjectRecords — scatter this board's ROM object-init records into two
 * parallel work-RAM attribute arrays.  ROM 0x2441.
 *
 * Board-setup helper, reached once per board from loc_0d5f (`call 0x2441` at ROM
 * 0x0D62). It selects a per-board table of fixed 5-byte records in ROM, walks it,
 * and de-interleaves each record into one of two structure-of-arrays destination
 * groups, routed by the record's leading TYPE byte:
 *
 *   - Record layout (5 bytes): [type, fieldA, fieldB, (unused +3), fieldC].
 *   - TYPE 0  -> the IX group OBJ_PARAM_TABLE0 (0x6300): fieldA -> +0, fieldB -> +0x15,
 *               fieldC -> +0x2a, then the group index advances by one (three parallel
 *               arrays, stride 0x15).
 *   - TYPE 1  -> the IY group OBJ_PARAM_TABLE1 (0x6310), same +0/+0x15/+0x2a de-interleave
 *               and advance.
 *   - TYPE 0xAA -> terminator: return. THE ONLY EXIT.
 *   - Any other TYPE -> skip this record (advance 5 bytes) and continue.
 *
 * Two small heads run before the walk:
 *   - HEAD A picks the IY group's base. It forms an 8-bit modular checksum, seeded
 *     with 0x5E, over the six ROM bytes at 0x3F0C; base is OBJ_PARAM_TABLE1 (0x6310)
 *     when the checksum is 0, else 0x6311. On the shipped ROM those bytes sum the
 *     checksum to exactly 0, so the base is always 0x6310 and the 0x6311 arm is dead
 *     in practice — but it is modelled faithfully (a data-integrity guard whose result
 *     is a constant here).
 *   - HEAD B picks the ROM record table from BOARD (0x6227): 1->0x3AE4, 2->0x3B5D,
 *     3->0x3BE5, and everything else (4, 0, 5+) -> the default table 0x3C8B.
 *
 * The oracle's walk is a JUMP cycle with no call/push/pop/rst in its 115 bytes, so it
 * is a flat loop, not recursion. This routine calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2441.test.js.
 * GATE:     crafted-entry — the real board-1 dispatch (attract only ever sets up 25m)
 *           validates the 0x3AE4 table + both type routers; the 0x3B5D/0x3BE5/0x3C8B
 *           table arms and the default arm are reached by identical-both-sides BOARD
 *           pokes (2/3/4/0 — Karl-sanctioned board poke). Fresh clone per case (writes
 *           RAM). Two teeth: a field-offset twin and a HEAD-A mis-seed twin, both caught
 *           on the real dispatch (board 1 has 11 type-0 and 4 type-1 records).
 * LIVE-OUT: memory-only — the de-interleaved bytes in the two 0x63xx arrays. The sole
 *           caller (loc_0d5f) reloads HL/A/DE/BC and never reads IX/IY or any flag this
 *           leaves before overwriting it, so every register/flag is dead. pc and SP are
 *           not live either: the oracle's terminal `ret` (pc<-return addr, SP+2) is the
 *           modelled stack ABI the direct-call layer replaces with a JS return, and the
 *           harness supplies one m.ret() on the candidate to line them up.
 * NAMES:    BOARD (0x6227), OBJ_PARAM_TABLE0 (0x6300), OBJ_PARAM_TABLE1 (0x6310) from
 *           names.js — the board selector and the two destination group bases (the ABC
 *           naming pass named them: this routine is cited as the de-interleaver). The
 *           rest stays hex: the checksum/record ROM addresses (0x3F0C,
 *           0x3AE4/0x3B5D/0x3BE5/0x3C8B) are ROM data; +0/+0x15/+0x2a are record field
 *           strides.
 */

import { BOARD, OBJ_PARAM_TABLE0, OBJ_PARAM_TABLE1 } from "./names.js";

// HEAD A — the ROM checksum that picks the IY group base.
const CHECKSUM_SEED = 0x5e;
const CHECKSUM_ROM = 0x3f0c; // six ROM data bytes, summed mod 256
const CHECKSUM_LEN = 6;

// Per-board ROM record tables (ROM data addresses — kept hex).
const TABLE_BOARD_1 = 0x3ae4;
const TABLE_BOARD_2 = 0x3b5d;
const TABLE_BOARD_3 = 0x3be5;
const TABLE_DEFAULT = 0x3c8b; // board 4, board 0, and levels 5+

// Record shape.
const RECORD_STRIDE = 5; // bytes per record (`ld de,0x0005` skip step)
const FIELD_A = 0x00; // destination offsets within a group
const FIELD_B = 0x15;
const FIELD_C = 0x2a;
const TYPE_IX = 0x00; // route to the IX group
const TYPE_IY = 0x01; // route to the IY group
const TYPE_END = 0xaa; // terminator

export function loadBoardObjectRecords(m) {
  const { mem } = m;

  // -- HEAD A: 8-bit modular checksum picks the IY group base -------------
  let checksum = CHECKSUM_SEED;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    checksum = (checksum + mem.read8((CHECKSUM_ROM + i) & 0xffff)) & 0xff;
  }
  // 0 -> 0x6310, non-zero -> 0x6311 (the ROM sums this to 0, so 0x6310 in practice).
  let iy = checksum === 0 ? OBJ_PARAM_TABLE1 : (OBJ_PARAM_TABLE1 + 1) & 0xffff;

  // -- HEAD B: BOARD picks the ROM record table --------------------------
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
