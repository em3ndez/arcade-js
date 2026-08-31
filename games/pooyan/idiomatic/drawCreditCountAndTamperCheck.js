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
 * drawCreditCountAndTamperCheck — paint the credit count as two HUD digit tiles, then trip a hidden ROM-integrity check.
 *
 * WHAT IT IS
 *   The credit-HUD render step. It draws the credit field, reads the running
 *   credit counter, and lays the count into video RAM as two side-by-side digit
 *   tiles (tens + units). Folded into that same render is a passive anti-tamper
 *   tripwire — a checksum over a fixed block of program bytes that quietly bumps
 *   a strike counter if the ROM image has been altered.
 *
 * ROLE IN THE MACHINE
 *   This is what the credit number the player sees on the attract/idle screen is
 *   built from: it converts the internal binary credit tally into the two tiles
 *   the tilemap displays. The interleaved checksum is characteristic of this
 *   ROM's anti-tamper style — an integrity probe hidden inside an ordinary
 *   drawing routine, so that a patched image betrays itself during normal
 *   operation rather than at a single easily-bypassed boot test. The check is a
 *   tripwire only; it does not touch the credit accounting itself.
 *
 * ROM ADDRESS: 0x05ee-0x0629.
 * GROUNDING: [seen].
 *
 * LIVE-OUT (what it leaves in memory):
 *   - CREDIT_HUD_UNITS_VRAM (0x869f): the units-digit tile — always written.
 *   - CREDIT_HUD_TENS_VRAM  (0x86bf): the tens-digit tile — written only when
 *     the tens nibble is nonzero (leading-zero suppression, so a count under 10
 *     shows a single digit).
 *   - TAMPER_STRIKES_HUD_GUARD (0x8a3c): incremented by one when the tamper
 *     tripwire fires (checksum miss). Untouched on the common path.
 */

// The clean-image checksum tuning constants and the field/nibble selectors this
// render depends on. The checksum block, its length, and its sentinel are fixed
// properties of the program image, so an altered image sums to a value other
// than CKSUM_SENTINEL and the tripwire bumps its strike counter.
const CREDIT_FIELD = 0x05; //    field-table selector for the credit field
const CREDIT_MAX = 0x63; //      clamp: credit count caps at 99
const TENS_MASK = 0xf0;
const UNITS_MASK = 0x0f;
const TRIP_UNITS_DIGIT = 0x02; // the units digit that arms the checksum tripwire
const CKSUM_LEN = 0x1f; //       31 program bytes summed
const CKSUM_SENTINEL = 0x8c; //  the sum a clean program image produces

export function drawCreditCountAndTamperCheck(m) {
  const { mem8 } = m;

  // Draw the credit field itself — the static label/frame tiles that surround
  // the digits — by selecting field 5 from the field table and stamping its
  // stacked characters bottom-up into video RAM.
  drawStackedCharField(m, CREDIT_FIELD);

  // Read the running credit tally at CREDIT_COUNT (0x8802) and clamp it to 99.
  // The counter can legitimately reach its accrual ceiling, and the HUD has room
  // for only two digits, so any value at or above 0x63 is pinned to 0x63. The
  // clamped binary value is then converted to packed BCD, giving one decimal
  // digit per nibble (tens in the high nibble, units in the low nibble).
  const credit = mem8[CREDIT_COUNT];
  const clamped = credit < CREDIT_MAX ? credit : CREDIT_MAX;
  const bcd = byteToPackedBcd(m, clamped);

  // Emit the two digit tiles. The tens nibble is written to CREDIT_HUD_TENS_VRAM
  // (0x86bf) only when it is nonzero, so a count below ten shows no leading
  // zero. The units nibble is always written to CREDIT_HUD_UNITS_VRAM (0x869f).
  // With the digits laid down, the render's visible job is done: unless the
  // units digit is exactly 2, the routine returns here and the tamper tripwire
  // below never runs — the check is deliberately sampled only on that one digit
  // value so it costs nothing on almost every refresh.
  if ((bcd & TENS_MASK) !== 0) mem8[CREDIT_HUD_TENS_VRAM] = bcd >> 4;
  const units = bcd & UNITS_MASK;
  mem8[CREDIT_HUD_UNITS_VRAM] = units;
  if (units !== TRIP_UNITS_DIGIT) return;

  // The hidden tripwire. Roll an 8-bit sum over 31 program bytes starting at the
  // top of the guarded block, HUD_GUARD_CKSUM_TOP (0x64c8), and walking downward
  // in memory. Both the running sum and the address wrap as 8- and 16-bit
  // quantities, matching the hardware's fixed-width arithmetic.
  let ptr = HUD_GUARD_CKSUM_TOP;
  let sum = 0;
  for (let count = CKSUM_LEN; count !== 0; count--) {
    sum = u8(sum + mem8[ptr]);
    ptr = u16(ptr - 1);
  }
  // A clean program image sums to the sentinel 0x8c; if it matches, the block is
  // intact and the routine leaves quietly. Any other total means the guarded
  // bytes have been altered, so bump the anti-tamper strike counter at
  // TAMPER_STRIKES_HUD_GUARD (0x8a3c) — the accumulated strikes are read
  // elsewhere to degrade the machine's behavior once tampering is detected.
  if (sum === CKSUM_SENTINEL) return;
  mem8[TAMPER_STRIKES_HUD_GUARD] = mem8[TAMPER_STRIKES_HUD_GUARD] + 1;
}
