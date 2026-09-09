// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_0400, loc_0500, loc_0600, loc_0700, loc_54, loc_64,
  loc_8b, loc_8c, loc_8d, loc_8e, loc_8f, loc_90, loc_91, loc_92, loc_93, loc_94,
  loc_d5, loc_e3, loc_e5, loc_018b, loc_018c, loc_018d,
  POKEY_RANDOM, loc_100f, loc_1c03, loc_1c04, loc_2000,
} from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
import { loadHighScoreTableFromEarom } from "./loadHighScoreTableFromEarom.js";

// One packed-BCD subtract byte in NMOS 6502 style: the VALUE is decimal-corrected, but the carry-out and
// N flag come from the plain binary subtraction (that is what a multi-byte chain threads/tests). [code]
function decSubByte(a, v, carryIn) {
  const borrow = 1 - carryIn;
  const diff = a - v - borrow;
  const carry = diff >= 0 ? 1 : 0;      // binary borrow-out (C)
  const negative = (diff & 0x80) !== 0; // binary sign (N)
  let low = (a & 0x0f) - (v & 0x0f) - borrow;
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let sum = (a & 0xf0) - (v & 0xf0) + low;
  if (sum < 0) sum -= 0x60;
  return { value: sum & 0xff, carry, negative };
}

/**
 * loc_3c97 — the self-test checksum screen. Re-clears the work/video/object pages, seeds the $54/$64 rows,
 * folds each 2KB program bank into a one-byte XOR checksum and plots the four results, reloads the
 * high-score mirror from NVRAM, then runs a packed-BCD countdown that lands an iteration count in $8d
 * before chaining into the input-test screen. [code]
 */
export function loc_3c97(m) {
  const { mem8, mem16 } = m;

  // Re-clear zeropage and pages 4/5/6; fill page 7 with its own index.
  for (let x = 0; ; x = (x + 1) & 0xff) {
    mem8[loc_0700 + x] = x;
    mem8[(loc_00 + x) & 0xff] = 0;
    mem8[loc_0400 + x] = 0;
    mem8[loc_0500 + x] = 0;
    mem8[loc_0600 + x] = 0;
    if (((x + 1) & 0xff) === 0) break;
  }
  mem8[loc_d5] = 0xff;
  mem8[loc_e3] = 0xff;
  mem8[loc_1c03] = 0;
  mem8[loc_1c04] = 0;

  // Seed the $54/$64 rows to index | 0x80.
  for (let x = 0x0f; x >= 0; x--) {
    const v = x | 0x80;
    mem8[(loc_54 + x) & 0xff] = v;
    mem8[(loc_64 + x) & 0xff] = v;
  }

  // Two RNG reads XOR to zero (clock-free layer holds the poly counter constant).
  mem8[loc_e5] = mem8[POKEY_RANDOM] ^ mem8[POKEY_RANDOM];
  mem8[loc_100f] = 3;

  // Fold each 2KB program bank into a one-byte checksum: XOR 8 pages, push, reset the accumulator.
  mem8[loc_8b] = 0;
  mem8[loc_8c] = 0x20;
  const checksums = [];
  let acc = 0xff;
  for (let bank = 0x1f; bank >= 0; bank--) {
    mem8[loc_2000] = bank; // watchdog kick
    for (let y = 0; ; y = (y + 1) & 0xff) {
      acc ^= mem8[(mem16[loc_8b] + y)];
      if (((y + 1) & 0xff) === 0) break;
    }
    if ((bank & 0x07) === 0) { checksums.push(acc); acc = 0xff; } // bank boundary: publish and reset
    mem8[loc_8c] = (mem8[loc_8c] + 1);
  }

  // Plot the four checksums (skip a zero one) through the ($91) draw cursor.
  mem8[loc_92] = 4;
  for (let x = 3; x >= 0; x--) {
    mem8[loc_91] = x ^ 0x3f;
    const checksum = checksums.pop();
    if (checksum === 0) continue;
    writeMaskedByteAndAdvancePointer(m, x | 0x20);
    writeMaskedByteAndAdvancePointer(m, 0);
    plotByteAsTwoDigits(m, checksum, false);
  }

  loadHighScoreTableFromEarom(m, 0); // A live-in is a don't-care; the NVRAM read overwrites it

  // Copy the 7-byte high-score header down into the $8e work row.
  for (let y = 6; y >= 0; y--) mem8[loc_8e + y] = mem8[loc_018b + y];

  // Packed-BCD countdown: repeatedly subtract the $8e.. value from the $91.. accumulator until it goes
  // negative, counting iterations in Y. A zero header skips the loop and leaves Y at its post-copy value.
  let y = 0xff;
  if ((mem8[loc_018b] | mem8[loc_018c] | mem8[loc_018d]) !== 0) {
    y = 0;
    for (;;) {
      y = (y + 1) & 0xff;
      if (y === 0) break;
      let carry = 1;
      let r;
      r = decSubByte(mem8[loc_91], mem8[loc_8e], carry); mem8[loc_91] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_92], mem8[loc_8f], carry); mem8[loc_92] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_93], mem8[loc_90], carry); mem8[loc_93] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_94], 0, carry); mem8[loc_94] = r.value;
      if (r.negative) break;
    }
  }
  mem8[loc_8d] = y;

  return m.call(0x3d57); // fall into the input-test screen (cyclic spine — kept)
}
