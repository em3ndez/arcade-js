// SPDX-License-Identifier: GPL-3.0-only
import {
  OBJ_66A0_SPRITE_RECORD,
  OBJ_RECORD_66A0,
} from "./names.js";
/**
 * loc_11fa — scatter a six-byte source record into a fixed record plus a four-byte array.
 *
 * Straight-line struct initialiser: reads six consecutive bytes from the caller's HL pointer,
 * stamps a constant tag plus the six bytes into a fixed scattered-field record, and mirrors the
 * first four bytes into a fixed contiguous array in the sprite shadow buffer.
 *
 * LIVE-OUT: memory-only — the eleven bytes written.
 */
export function loc_11fa(m, hl = m.regs.hl) {
  const { mem8 } = m;

  const REC = OBJ_RECORD_66A0;

  const src = hl;
  const b0 = mem8[(src + 0) & 0xffff];
  const b1 = mem8[(src + 1) & 0xffff];
  const b2 = mem8[(src + 2) & 0xffff];
  const b3 = mem8[(src + 3) & 0xffff];
  const b4 = mem8[(src + 4) & 0xffff];
  const b5 = mem8[(src + 5) & 0xffff];

  // Field order is scrambled (+5 written after +8), but the targets are distinct so the memory
  // left behind is order-independent.
  mem8[REC + 0x00] = 0x01;
  mem8[REC + 0x03] = b0;
  mem8[REC + 0x07] = b1;
  mem8[REC + 0x08] = b2;
  mem8[REC + 0x05] = b3;
  mem8[REC + 0x09] = b4;
  mem8[REC + 0x0a] = b5;

  mem8[OBJ_66A0_SPRITE_RECORD + 0] = b0;
  mem8[OBJ_66A0_SPRITE_RECORD + 1] = b1;
  mem8[OBJ_66A0_SPRITE_RECORD + 2] = b2;
  mem8[OBJ_66A0_SPRITE_RECORD + 3] = b3;
}
