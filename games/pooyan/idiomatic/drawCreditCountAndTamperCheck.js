// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { drawStackedCharField } from "./drawStackedCharField.js";
import { byteToPackedBcd } from "./byteToPackedBcd.js";
import {
  CREDIT_COUNT,
  CREDIT_HUD_TENS_VRAM,
  CREDIT_HUD_UNITS_VRAM,
  HUD_GUARD_CKSUM_TOP,
  TAMPER_STRIKES_HUD_GUARD,
} from "./names.js";
/**
 * drawCreditCountAndTamperCheck — draw the credit count as two HUD digit tiles, then a hidden checksum tripwire.
 *
 * Draws the credit field, then reads the credit count clamped to 99 and converts it to packed
 * BCD: the high nibble becomes the tens tile (skipped when zero) and the low nibble the units
 * tile. Only when the units digit is exactly 2 does it sum a fixed 31-byte program block downward;
 * if that sum misses its sentinel it bumps an anti-tamper strike counter.
 *
 * LIVE-OUT: none — a dispatch target whose exit registers differ per path and are unconsumed.
 */

const CREDIT_FIELD = 0x05; //    field-table selector for the credit field
const CREDIT_MAX = 0x63; //      clamp: credit count caps at 99
const TENS_MASK = 0xf0;
const UNITS_MASK = 0x0f;
const TRIP_UNITS_DIGIT = 0x02; // the units digit that arms the checksum tripwire
const CKSUM_LEN = 0x1f; //       31 program bytes summed
const CKSUM_SENTINEL = 0x8c; //  the sum a clean program image produces

export function drawCreditCountAndTamperCheck(m) {
  const { mem8 } = m;

  drawStackedCharField(m, CREDIT_FIELD);

  const credit = mem8[CREDIT_COUNT];
  const clamped = credit < CREDIT_MAX ? credit : CREDIT_MAX;
  const bcd = byteToPackedBcd(m, clamped);

  if ((bcd & TENS_MASK) !== 0) mem8[CREDIT_HUD_TENS_VRAM] = bcd >> 4;
  const units = bcd & UNITS_MASK;
  mem8[CREDIT_HUD_UNITS_VRAM] = units;
  if (units !== TRIP_UNITS_DIGIT) return;

  let ptr = HUD_GUARD_CKSUM_TOP;
  let sum = 0;
  for (let count = CKSUM_LEN; count !== 0; count--) {
    sum = u8(sum + mem8[ptr]);
    ptr = u16(ptr - 1);
  }
  if (sum === CKSUM_SENTINEL) return;
  mem8[TAMPER_STRIKES_HUD_GUARD] = mem8[TAMPER_STRIKES_HUD_GUARD] + 1;
}
