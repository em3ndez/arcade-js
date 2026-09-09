// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_94, loc_c2, loc_9c, loc_9a, loc_ab, loc_34, loc_74, loc_00, loc_44,
  loc_f0, loc_64, loc_54, loc_8b, loc_73, loc_43, loc_53, loc_f4, loc_fe, loc_97,
  POKEY_RANDOM,
} from "./names.js";

/**
 * rebuildSegmentSpriteTables — rebuild a centipede segment's five 12-entry sprite
 * tables for the selected object, from its per-slot counters and descriptor rows:
 *   1. When the gate is clear and the counter is >= 3, tick the length counter
 *      (wrapping 0 -> 0x0c) and reset it to 1 or 2.
 *   2. Seed the [0] entries (length, negate flag, colour, base).
 *   3. Copy the descriptor rows into the tables for slots 1..length-1.
 *   4. Random-fill the remaining slots (only when the length counter isn't full).
 *   5. Mark the slot rebuilt.
 * Two's-complement mirrors are inlined as (0x100 - v) & 0xff. RAM-only outputs. [code]
 */
export function rebuildSegmentSpriteTables(m) {
  const x0 = m.mem8[loc_88];

  // --- step 1: refresh the counters when the gate is clear ---
  if (m.mem8[(loc_94 + x0) & 0xff] === 0) {
    m.mem8[(loc_c2 + x0) & 0xff] = m.mem8[(loc_c2 + x0) & 0xff] | 0x80;
    if (m.mem8[(loc_9c + x0) & 0xff] >= 0x03) {
      let len = (m.mem8[(loc_9a + x0) & 0xff] - 1) & 0xff;
      if (len === 0) len = 0x0c; // wrap 0 -> 0x0c
      m.mem8[(loc_9a + x0) & 0xff] = len;
      let count = 0x02;
      if (m.mem8[(loc_ab + x0) & 0xff] < 0x04) count = 0x01;
      m.mem8[(loc_9c + x0) & 0xff] = count;
    }
  }

  // --- step 2: seed the [0] entries ---
  m.mem8[loc_34] = 0x03;
  const s = m.mem8[(loc_9c + x0) & 0xff];
  m.mem8[loc_74] = s;
  let e44 = s;
  if ((m.mem8[loc_00] & 0x02) === 0) e44 = (0x100 - s) & 0xff; // negate unless bit1 is set
  m.mem8[loc_44] = e44;
  m.mem8[loc_64] = 0xf8 ^ m.mem8[loc_f0];
  m.mem8[loc_54] = 0x80;
  const span = m.mem8[(loc_9a + x0) & 0xff];
  m.mem8[loc_8b] = span;

  // --- step 3: descriptor-copy loop over slots 1..length-1 (skipped when length == 1) ---
  let runFillLoop = true;
  if (span !== 0x01) {
    let y = 0x42;
    let x = 0x01;
    do {
      m.mem8[(loc_34 + x) & 0xff] = y;
      m.mem8[(loc_64 + x) & 0xff] = 0xf8 ^ m.mem8[loc_f0];
      m.mem8[(loc_74 + x) & 0xff] = m.mem8[(loc_73 + x) & 0xff];
      const desc = m.mem8[(loc_43 + x) & 0xff];
      m.mem8[(loc_44 + x) & 0xff] = desc;
      let base = (desc & 0x80) ? 0x08 : 0xf8; // sign of desc picks the base
      base = (base + m.mem8[(loc_53 + x) & 0xff]) & 0xff;
      m.mem8[(loc_54 + x) & 0xff] = base;
      y = (y - 1) & 0xff;
      if (y === 0x3f) y = 0x47;
      x = (x + 1) & 0xff;
    } while (x < m.mem8[loc_8b]);

    // when this slot's length counter now reads full (0x0c), skip the step-4 fill.
    if (m.mem8[(loc_9a + m.mem8[loc_88]) & 0xff] === 0x0c) runFillLoop = false;
  }

  // --- step 4: random-fill slots length..0x0b ---
  if (runFillLoop) {
    let carry = 0xf8 ^ m.mem8[loc_f0];
    let x = m.mem8[loc_8b];
    do {
      m.mem8[(loc_64 + x) & 0xff] = carry;
      m.mem8[(loc_34 + x) & 0xff] = 0x00;
      let a = 0x02;
      const f4 = m.mem8[loc_f4];
      if (f4 !== 0) a = f4;
      m.mem8[(loc_74 + x) & 0xff] = a;
      if (m.mem8[POKEY_RANDOM] & 0x80) a = (0x100 - a) & 0xff; // negate on random bit7
      m.mem8[(loc_44 + x) & 0xff] = a;
      m.mem8[(loc_54 + x) & 0xff] = m.mem8[POKEY_RANDOM] & 0xf8; // random & 0xf8
      carry = m.mem8[(loc_64 + x) & 0xff]; // reload the value just stored (invariant)
      x = (x + 1) & 0xff;
    } while (x < 0x0c);
  }

  // --- step 5: mark the slot rebuilt ---
  m.mem8[(loc_94 + m.mem8[loc_88]) & 0xff] = 0x0c;
  m.mem8[loc_97] = m.mem8[loc_fe];
  // rts omitted; the withOmittedRet seam completes it.
}
