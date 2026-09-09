// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_34, loc_54, loc_64, loc_88, loc_8a, loc_8b, loc_8d, loc_8e, loc_8f, loc_90,
  loc_91, loc_92, loc_93, loc_94, loc_b9, loc_bb, loc_bd, loc_bf,
  loc_dd, loc_de, loc_df, loc_e0, loc_e1, loc_e2, loc_e3, loc_e4, loc_e5,
  loc_e6, loc_e7, loc_e8, loc_e9, loc_ea, loc_eb, loc_ec, loc_ed, loc_f9, loc_fa,
  loc_018b, loc_018c, loc_018d, HIGH_SCORE_CHECKSUM,
  loc_0400, DSW1, DSW2, IN0, IN2, IN3, IN1,
  POKEY_RANDOM, AUDF1, AUDC1, PALETTE_COLOR_04, loc_140c, FLIP_SCREEN, WATCHDOG, loc_2400, loc_3fd8,
} from "./names.js";
import { redrawPointerTableRowUnblanked } from "./redrawPointerTableRowUnblanked.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";
import { tickEaromWriteback } from "./tickEaromWriteback.js";

const SERVICE = 0x20; // IN0 service-switch bit (idle high, cleared while held). [code]

// One NMOS-decimal ADC byte: value is nibble-corrected; carry-out folds in the +0x60 correction. [code]
function decAddByte(a, v, carryIn) {
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return { value: sum & 0xff, carry: sum >= 0x100 ? 1 : 0 };
}

/**
 * loc_3d57 — the operator self-test input screen: an endless per-frame loop, only reached with the service
 * switch held. selfTestInputPass is one pass; loc_3d57 runs it forever. Each pass paces on the $8a bit-walk
 * and the service switch, folds each input port into a rolling 2-bit debounce that drives colour/flip/counter
 * side effects, draws the DIP and port states through the row/glyph/digit writers, serialises the port
 * snapshot bytes into a bit grid, then either plots the running high-score checksum digits or, when it is
 * stable, the stored score. The pacing loops poll the beam/switch (clock-coupled). The stack pointer is a
 * scratch counter here (modelled as a local), so its page-1 churn is not reproduced. [code]
 */
export function selfTestInputPass(m) {
  const { mem8, mem16 } = m;

  // Pace: walk the $8a timing bit down until a set bit falls out, then wait for the service switch.
  for (;;) { const bit = mem8[loc_8a] & 1; mem8[loc_8a] = mem8[loc_8a] >> 1; if (bit) break; }
  while ((mem8[IN0] & SERVICE) !== 0) { /* wait for the service switch to clear */ }
  mem8[WATCHDOG] = 0; // watchdog

  // Debounce IN1 bit0 into $ea; on a 0b10 edge advance the sound/colour cursors.
  mem8[loc_ea] = ((mem8[loc_ea] << 1) | (mem8[IN1] & 1));
  if ((mem8[loc_ea] & 0x03) === 0x02) {
    const oldE6 = mem8[loc_e6];
    mem8[loc_e6] = (oldE6 + 2) & 0x06;
    mem8[(AUDC1 + oldE6)] = 0;
    mem8[loc_e7] = (mem8[loc_e7] + 1) & 0x0f;
    const e8 = (mem8[loc_e8] + 1) & 0x0f;
    mem8[PALETTE_COLOR_04] = e8;
    mem8[loc_e8] = e8;
  }

  // Debounce IN1 bit1 into $eb; on a 0b10 edge fan a colour ramp into the palette rows.
  mem8[loc_eb] = ((mem8[loc_eb] << 1) | ((mem8[IN1] >> 1) & 1));
  if ((mem8[loc_eb] & 0x03) === 0x02) {
    mem8[loc_e9] = (mem8[loc_e9] + 1);
    let a = mem8[loc_e9];
    for (let y = 1; y < 4; y++) {
      a = (a + 1) & 0x0f;
      mem8[(PALETTE_COLOR_04 + y)] = a;
      mem8[(loc_140c + y)] = a;
    }
  }

  // Debounce IN1 bit2 into $ec; on a 0b10 edge clear flip and bump the $34 row counters.
  mem8[loc_ec] = ((mem8[loc_ec] << 1) | ((mem8[IN1] >> 2) & 1));
  if ((mem8[loc_ec] & 0x03) === 0x02) {
    mem8[loc_bd] = 0; mem8[loc_bf] = 0; mem8[loc_2400] = 0;
    mem8[FLIP_SCREEN] = 1;
    mem8[loc_88] = 1;
    for (let x = 0x0f; x >= 0; x--) mem8[(loc_34 + x) & 0xff] = (mem8[(loc_34 + x) & 0xff] + 1);
  }

  // Debounce IN1 bit3 into $ed; on a 0b10 edge set flip.
  mem8[loc_ed] = ((mem8[loc_ed] << 1) | ((mem8[IN1] >> 3) & 1));
  if ((mem8[loc_ed] & 0x03) === 0x02) {
    mem8[loc_bd] = 0; mem8[loc_bf] = 0; mem8[loc_2400] = 0;
    mem8[loc_88] = 2;
    mem8[FLIP_SCREEN] = 0xff;
  }

  // Draw the option DIP row: five cells reading down the high bit of the DIP index.
  mem8[loc_92] = 5;
  mem8[loc_91] = 0x38;
  mem8[loc_8b] = (((mem8[DSW1] & 0x0c) >> 2) + 1);
  for (let x = 5; x > 0; x--) {
    writeMaskedByteAndAdvancePointer(m, (mem8[loc_8b] & 0x80) ? 0 : 0x1f);
    mem8[loc_8b] = (mem8[loc_8b] - 1);
  }

  // Draw the coin/bonus config glyphs.
  mem8[loc_91] = 0x37;
  writeMaskedByteAndAdvancePointer(m, 0x21);
  writeMaskedByteAndAdvancePointer(m, (((mem8[DSW2] & 0x10) >> 4) + 1) | 0x20);
  let sel = (mem8[DSW2] & 0x0c) >> 2;
  if (sel === 0) sel = 0xfe;
  writeMaskedByteAndAdvancePointer(m, ((sel + 3) & 0xff) | 0x20);

  mem8[loc_91] = 0x36;
  mem8[(mem16[loc_91] + 0)] = 0;
  mem8[(mem16[loc_91] + 0x40)] = 0;
  const lives = mem8[DSW2] >> 5;
  if (lives !== 0 && lives < 6) {
    writeMaskedByteAndAdvancePointer(m, mem8[loc_3fd8 + lives]);
    writeMaskedByteAndAdvancePointer(m, 0);
    writeMaskedByteAndAdvancePointer(m, lives === 3 ? 0x22 : 0x21);
  }

  // Row header colour depends on a DIP flag; redraw the row from its first descriptor.
  mem8[loc_94] = 0x3f;
  mem8[loc_93] = (mem8[DSW1] & 0x40) ? 0xf2 : 0xee;
  mem8[loc_91] = 0x35;
  redrawPointerTableRowUnblanked(m);

  // Snapshot the input ports for the bit grid.
  mem8[loc_df] = mem8[IN1];
  mem8[loc_dd] = mem8[DSW1];
  mem8[loc_de] = mem8[DSW2];
  mem8[loc_e0] = mem8[IN0] & 0x8f;
  mem8[loc_e1] = mem8[IN2] & 0x8f;
  mem8[loc_e2] = mem8[IN3];
  const rnd = mem8[POKEY_RANDOM];
  mem8[loc_e3] = mem8[loc_e3] & rnd;
  mem8[loc_e4] = mem8[loc_e4] | rnd;

  // Position finder: count the clear bits above the top set bit of (IN1<<1)|1.
  let scan = ((mem8[IN1] << 1) | 1) & 0xff;
  let scanCarry = (mem8[IN1] & 0x80) !== 0;
  let pos = 0;
  for (;;) {
    if (!scanCarry) pos = (pos + 1) & 0xff;
    scanCarry = (scan & 0x80) !== 0;
    scan = (scan << 1) & 0xff;
    if (scan === 0) break;
  }
  // Play the position tone (POKEY, off-diff) and advance the $54/$64 object cursors.
  const voice = mem8[loc_e6];
  mem8[(AUDF1 + voice)] = (pos << 3);
  mem8[(AUDC1 + voice)] = pos | 0xa0;
  const idx = mem8[loc_e7];
  const b9 = mem8[loc_b9];
  mem8[loc_b9] = 0;
  mem8[(loc_54 + idx) & 0xff] = (b9 + mem8[(loc_54 + idx) & 0xff]);
  const before64 = mem8[(loc_64 + idx) & 0xff];
  const bb = mem8[loc_bb];
  mem8[loc_bb] = 0;
  mem8[(loc_64 + idx) & 0xff] = (before64 - bb);

  // Serialise the six snapshot bytes ($dd..$e2) MSB-first into a grid of 0x21/0x20 cells. The stack
  // pointer is the outer row index (5..0); each row rolls one snapshot byte out through the carry.
  let carry = before64 >= bb; // carry into the first roll = the $64-cursor subtract's borrow-out
  let y = 0xd0;
  for (let s = 5; (s & 0x80) === 0; s = (s - 1) & 0xff) {
    for (let bitn = 7; bitn >= 0; bitn--) {
      const old = mem8[loc_dd + s];
      mem8[loc_dd + s] = ((old << 1) | (carry ? 1 : 0));
      carry = (old & 0x80) !== 0;
      y = (y + 1) & 0xff;
      mem8[loc_0400 + y] = carry ? 0x21 : 0x20;
    }
    const beforeStride = y;
    y = (y - 0x28) & 0xff;
    carry = beforeStride >= 0x28; // the row-stride subtract's carry threads into the next row's first roll
  }

  // Draw the "no input" marker unless every input line has toggled, then run the two spine tails.
  mem8[loc_92] = 4;
  mem8[loc_91] = 0x3a;
  const anyStuck = ((mem8[loc_e4] ^ 0xff) | mem8[loc_e3] | mem8[loc_e5]) !== 0;
  writeMaskedByteAndAdvancePointer(m, anyStuck ? 0x25 : 0);

  tickEaromWriteback(m);
  const [delta, oldChecksum, deltaZero] = foldHighScoreChecksum(m);
  mem8[HIGH_SCORE_CHECKSUM] = oldChecksum; // publish the prior checksum

  if (!deltaZero) {
    // Checksum changed: plot its two digits (the digit carry rides the pointer advance of the zero plot).
    mem8[loc_91] = 0x3b;
    writeMaskedByteAndAdvancePointer(m, 0x24);
    const zeroCarry = writeMaskedByteAndAdvancePointer(m, 0); // its exit carry feeds the digit plot below
    plotByteAsTwoDigits(m, delta, zeroCarry);
    return; // end this pass; the wrapper re-runs it next frame
  }

  // Checksum stable: plot the stored score and its bonus multiple.
  mem8[loc_92] = 4;
  mem8[loc_91] = 0xe9;
  let c = plotByteAsTwoDigits(m, mem8[loc_018d], true);
  c = plotByteAsTwoDigits(m, mem8[loc_018c], c);
  plotByteAsTwoDigits(m, mem8[loc_018b], false);

  mem8[loc_93] = 0xde;
  mem8[loc_94] = 0x3f;
  redrawPointerTableRowUnblanked(m);

  mem8[loc_92] = 5;
  mem8[loc_91] = 0x08;
  const hiDigit = decAddByte(mem8[loc_8d] >> 4, 0, 0).value; // BCD-normalise the high digit
  plotByteAsTwoDigits(m, hiDigit, true);
  writeMaskedByteAndAdvancePointer(m, 0x2e);

  let r = decAddByte(mem8[loc_8d] & 0x0f, 0, 0);
  mem8[loc_8e] = r.value;
  r = decAddByte(r.value, mem8[loc_8e], r.carry);
  mem8[loc_8e] = r.value;
  r = decAddByte(r.value, mem8[loc_8e], r.carry);
  let lowValue = r.value;
  if (lowValue >= 0x60) lowValue = 0x59;
  plotByteAsTwoDigits(m, lowValue, false);

  mem8[loc_93] = 0xe4;
  mem8[loc_94] = 0x3f;
  redrawPointerTableRowUnblanked(m);

  if ((mem8[loc_ea] | mem8[loc_eb] | mem8[loc_ec]) === 0) {
    mem8[HIGH_SCORE_CHECKSUM] = mem8[HIGH_SCORE_CHECKSUM] ^ 0xff;
    mem8[loc_f9] = 0x3d;
    mem8[loc_fa] = 0;
  }
  // end this pass; the wrapper re-runs it next frame
}

// The self-test input screen re-runs forever (a per-frame service loop; only the service switch, held,
// reaches here). Never returns.
export function loc_3d57(m) {
  for (;;) selfTestInputPass(m);
}
