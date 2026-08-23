// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_5489 } from "./loc_5489.js";
import {
  SPAWN_SEQUENCE_INDEX_8D14,
  SPAWN_KIND_TABLE_5627,
  INTEGRITY_GUARD_REGION_0BAD,
  INTEGRITY_GUARD_SIGNATURE_55B5,
  TAMPER_FREEZE_FLAG,
} from "./names.js";
/**
 * loc_5594 — scan an actor-block table and seed the first free slot (frame-timer spawner tail).
 *
 * Walks `count` stride-`stride` blocks from `base`, skipping live blocks ((blk+0)|(blk+1) != 0). At
 * the first free block it runs an anti-tamper self-check — summing the 8-byte INTEGRITY_GUARD_REGION
 * against its two's-complement signature; any nonzero pair bumps TAMPER_FREEZE_FLAG — then seeds the
 * kind byte from SPAWN_KIND_TABLE_5627 (low nibble of the advanced spawn cursor) and hands the record
 * to the init helper to finish init. One block seeded per call; none free -> falls out and returns.
 *
 * SEATING: BALANCED (net SP 0) — WIRE; the init helper's caller-skip balances this frame, seam
 * supplies the ret. DISSOLVED: the RST table fetch and the init helper (always skips -> returns false).
 * LIVE-OUT: none (memory only).
 */

const KIND_FIELD = 0x17; //       kind/script byte the init helper reads for its anim/speed lookup
const KIND_INDEX_MASK = 0x0f; //  low nibble of the spawn cursor indexes the kind table
const SPAWN_FIELD_VALUE = 0x13; // seeds the init helper's spawn-type field for this spawner
const GUARD_LEN = 0x08; //        the integrity guard/signature are 8 bytes each

export function loc_5594(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  let cursor = base;
  for (let i = 0; i < count; i++) {
    const live = (mem8[cursor] | mem8[u16(cursor + 1)]) !== 0;
    if (!live) {
      let mismatch = false;
      for (let j = 0; j < GUARD_LEN; j++) {
        if (u8(mem8[u16(INTEGRITY_GUARD_REGION_0BAD + j)] + mem8[u16(INTEGRITY_GUARD_SIGNATURE_55B5 + j)]) !== 0) {
          mismatch = true;
          break;
        }
      }
      if (mismatch) mem8[TAMPER_FREEZE_FLAG] = u8(mem8[TAMPER_FREEZE_FLAG] + 1);

      const idx = mem8[SPAWN_SEQUENCE_INDEX_8D14] & KIND_INDEX_MASK;
      const [kindByte] = loc_0020(m, SPAWN_KIND_TABLE_5627, idx);
      mem8[u16(cursor + KIND_FIELD)] = kindByte;
      if (!loc_5489(m, cursor, SPAWN_FIELD_VALUE)) return; // always skips -> propagate the skip
    }
    cursor = u16(cursor + stride);
  }
}
