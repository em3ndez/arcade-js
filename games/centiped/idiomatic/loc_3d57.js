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
// This is the addition twin of loc_3c97's decSubByte: the 6502 ADC in decimal mode corrects each nibble
// so the result stays valid BCD, carrying 6 out of a nibble that passed 9 and adding 0x60 when the whole
// byte overflowed a decade. Here it is used to BCD-normalise the bonus digits before they are plotted.
function decAddByte(a, v, carryIn) {
  // Low nibble: sum with carry-in, and if it exceeds 9 push it back into range and carry into the high.
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  // High nibble: sum, then apply the decimal +0x60 correction when the byte crossed 0xa0.
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return { value: sum & 0xff, carry: sum >= 0x100 ? 1 : 0 };
}

/**
 * loc_3d57 (ROM 0x3d57) — the operator self-test INPUT screen: an endless per-frame service loop reached
 * only while the service switch is held (the second of the two diagnostic screens; loc_3c97 falls into it).
 * selfTestInputPass is one frame's worth of work; loc_3d57 runs it forever.
 *
 * What one pass does: it paces on the $8a timing bit-walk and the service switch (so it advances one step
 * per frame in step with the beam), then debounces the four test buttons on IN1 -- each bit rolls into a
 * 2-bit history and a clean 0->1 edge (pattern 0b10) fires a side effect: cycling the sound voice, ramping
 * the palette colours, or toggling screen-flip and the row counters, so an operator can watch each control
 * do something visible/audible. It then draws the DIP-switch and port states through the row/glyph/digit
 * writers, snapshots the input ports and serialises them MSB-first into an on-screen bit grid, plays a tone
 * whose pitch encodes the trackball position, and finally either plots the running high-score checksum
 * (while it is still settling) or, once stable, the stored score and its bonus multiple.
 *
 * Two modelling notes: the pacing loops poll the beam/switch, which are clock-coupled, so they are written
 * as spin-waits; and the real routine abuses the stack pointer as a scratch row counter, which is modelled
 * as an ordinary local here since its page-1 churn has no observable effect. [code]
 */
export function selfTestInputPass(m) {
  const { mem8, mem16 } = m;

  // Pace: walk the $8a timing bit down until a set bit falls out, then wait for the service switch.
  // The bit-walk advances the screen exactly one phase per frame; the service-switch spin holds the
  // pass until the operator releases the switch, so the display updates at a human-readable rate.
  for (;;) { const bit = mem8[loc_8a] & 1; mem8[loc_8a] = mem8[loc_8a] >> 1; if (bit) break; }
  while ((mem8[IN0] & SERVICE) !== 0) { /* wait for the service switch to clear */ }
  // Kick the watchdog (write $2000) so the long, human-paced loop is never reset out from under itself.
  mem8[WATCHDOG] = 0; // watchdog

  // Debounce IN1 bit0 into $ea; on a 0b10 edge advance the sound/colour cursors. Each button reading is
  // shifted into a 2-bit history; the pattern 0b10 is the frame the button was pressed-then-released
  // (a clean falling edge), which is what fires the action exactly once per press.
  mem8[loc_ea] = ((mem8[loc_ea] << 1) | (mem8[IN1] & 1));
  if ((mem8[loc_ea] & 0x03) === 0x02) {
    // Rotate the active POKEY voice ($e6 steps 0->2->4->6->0), silence the voice just left, and bump
    // the object-cursor ($e7) and a palette colour ($e8, mirrored to PALETTE_COLOR_04) so the press
    // is both audible (a new channel) and visible (a colour change).
    const oldE6 = mem8[loc_e6];
    mem8[loc_e6] = (oldE6 + 2) & 0x06;
    mem8[(AUDC1 + oldE6)] = 0;
    mem8[loc_e7] = (mem8[loc_e7] + 1) & 0x0f;
    const e8 = (mem8[loc_e8] + 1) & 0x0f;
    mem8[PALETTE_COLOR_04] = e8;
    mem8[loc_e8] = e8;
  }

  // Debounce IN1 bit1 into $eb; on a 0b10 edge fan a colour ramp into the palette rows. Same 2-bit
  // edge detector as bit0, driving a different visible effect.
  mem8[loc_eb] = ((mem8[loc_eb] << 1) | ((mem8[IN1] >> 1) & 1));
  if ((mem8[loc_eb] & 0x03) === 0x02) {
    // Advance a base colour ($e9) and paint an incrementing ramp across palette entries 1..3 (and the
    // mirror table at $140c), so this button walks the whole colour bar one step per press.
    mem8[loc_e9] = (mem8[loc_e9] + 1);
    let a = mem8[loc_e9];
    for (let y = 1; y < 4; y++) {
      a = (a + 1) & 0x0f;
      mem8[(PALETTE_COLOR_04 + y)] = a;
      mem8[(loc_140c + y)] = a;
    }
  }

  // Debounce IN1 bit2 into $ec; on a 0b10 edge clear flip and bump the $34 row counters. This button
  // exercises the screen-flip latch in the "normal" orientation and rolls the timer/row bank.
  mem8[loc_ec] = ((mem8[loc_ec] << 1) | ((mem8[IN1] >> 2) & 1));
  if ((mem8[loc_ec] & 0x03) === 0x02) {
    // Reset the trackball sample cells, drive FLIP_SCREEN low (bit7 = 0 -> upright), select mode 1, and
    // increment all 16 $34 row counters so the operator sees the row bank tick.
    mem8[loc_bd] = 0; mem8[loc_bf] = 0; mem8[loc_2400] = 0;
    mem8[FLIP_SCREEN] = 1;
    mem8[loc_88] = 1;
    for (let x = 0x0f; x >= 0; x--) mem8[(loc_34 + x) & 0xff] = (mem8[(loc_34 + x) & 0xff] + 1);
  }

  // Debounce IN1 bit3 into $ed; on a 0b10 edge set flip. The mirror of the bit2 button: it drives the
  // flip latch the other way (bit7 = 1 -> inverted) so both cocktail orientations can be checked.
  mem8[loc_ed] = ((mem8[loc_ed] << 1) | ((mem8[IN1] >> 3) & 1));
  if ((mem8[loc_ed] & 0x03) === 0x02) {
    mem8[loc_bd] = 0; mem8[loc_bf] = 0; mem8[loc_2400] = 0;
    mem8[loc_88] = 2;
    mem8[FLIP_SCREEN] = 0xff;
  }

  // Draw the option DIP row: five cells reading down the high bit of the DIP index. The five cells show
  // whether each successive DIP position is set; $8b starts from the two coin/option bits of DSW1 and is
  // shifted so the writer reads its high bit for each cell (0 -> lit glyph, else blank).
  mem8[loc_92] = 5;
  mem8[loc_91] = 0x38;
  mem8[loc_8b] = (((mem8[DSW1] & 0x0c) >> 2) + 1);
  for (let x = 5; x > 0; x--) {
    writeMaskedByteAndAdvancePointer(m, (mem8[loc_8b] & 0x80) ? 0 : 0x1f);
    mem8[loc_8b] = (mem8[loc_8b] - 1);
  }

  // Draw the coin/bonus config glyphs: decode the DSW2 coinage/bonus fields into the little labels the
  // operator reads off this row (a leading marker, the bonus-life flag, and the coin-mode selector).
  mem8[loc_91] = 0x37;
  writeMaskedByteAndAdvancePointer(m, 0x21);
  writeMaskedByteAndAdvancePointer(m, (((mem8[DSW2] & 0x10) >> 4) + 1) | 0x20);
  let sel = (mem8[DSW2] & 0x0c) >> 2;
  if (sel === 0) sel = 0xfe;
  writeMaskedByteAndAdvancePointer(m, ((sel + 3) & 0xff) | 0x20);

  // Lives/bonus row: clear two cells, then, for a valid lives count (1..5 from the top DSW2 bits), plot
  // the count glyph from the ROM table at $3fd8 plus a suffix marker.
  mem8[loc_91] = 0x36;
  mem8[(mem16[loc_91] + 0)] = 0;
  mem8[(mem16[loc_91] + 0x40)] = 0;
  const lives = mem8[DSW2] >> 5;
  if (lives !== 0 && lives < 6) {
    writeMaskedByteAndAdvancePointer(m, mem8[loc_3fd8 + lives]);
    writeMaskedByteAndAdvancePointer(m, 0);
    writeMaskedByteAndAdvancePointer(m, lives === 3 ? 0x22 : 0x21);
  }

  // Row header colour depends on a DIP flag; redraw the row from its first descriptor. The $93/$94
  // colour/attribute pair is chosen from DSW1 bit6, then the whole descriptor row is repainted.
  mem8[loc_94] = 0x3f;
  mem8[loc_93] = (mem8[DSW1] & 0x40) ? 0xf2 : 0xee;
  mem8[loc_91] = 0x35;
  redrawPointerTableRowUnblanked(m);

  // Snapshot the input ports for the bit grid. Each port is latched into a $dd.. cell (masking off the
  // beam/vblank bits on IN0/IN2), and the POKEY RNG is folded into two accumulators: $e3 AND-narrows to
  // the bits that have ever read 0, $e4 OR-widens to the bits that have ever read 1 -- together they
  // prove the RNG is toggling every line.
  mem8[loc_df] = mem8[IN1];
  mem8[loc_dd] = mem8[DSW1];
  mem8[loc_de] = mem8[DSW2];
  mem8[loc_e0] = mem8[IN0] & 0x8f;
  mem8[loc_e1] = mem8[IN2] & 0x8f;
  mem8[loc_e2] = mem8[IN3];
  const rnd = mem8[POKEY_RANDOM];
  mem8[loc_e3] = mem8[loc_e3] & rnd;
  mem8[loc_e4] = mem8[loc_e4] | rnd;

  // Position finder: count the clear bits above the top set bit of (IN1<<1)|1. This turns the button
  // pattern into a small ordinal "position" number that then chooses the tone pitch below -- so each
  // control maps to a distinct audible note.
  let scan = ((mem8[IN1] << 1) | 1) & 0xff;
  let scanCarry = (mem8[IN1] & 0x80) !== 0;
  let pos = 0;
  for (;;) {
    if (!scanCarry) pos = (pos + 1) & 0xff;
    scanCarry = (scan & 0x80) !== 0;
    scan = (scan << 1) & 0xff;
    if (scan === 0) break;
  }
  // Play the position tone (POKEY, off-diff) and advance the $54/$64 object cursors. The pitch (AUDF)
  // is pos<<3 and the control byte (AUDC) carries pos in its low bits with 0xa0 forcing a fixed volume;
  // the active voice is the $e6 cursor the bit0 button rotates. Then the object cursors at $54/$64 are
  // nudged by the drained $b9/$bb deltas (each read-then-zeroed), coupling the trackball into the grid.
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
  // The six snapshot bytes ($dd..$e2) are shifted out MSB-first; every bit becomes one grid cell (a lit
  // 0x21 for a 1, blank 0x20 for a 0). The carry threaded between shifts is what the original 6502 ROL
  // chain produced, so the very first bit borrows the carry left over from the $64-cursor subtract above.
  let carry = before64 >= bb; // carry into the first roll = the $64-cursor subtract's borrow-out
  let y = 0xd0;
  for (let s = 5; (s & 0x80) === 0; s = (s - 1) & 0xff) {
    // Roll all 8 bits of this snapshot byte out through the carry, writing one grid cell per bit.
    for (let bitn = 7; bitn >= 0; bitn--) {
      const old = mem8[loc_dd + s];
      mem8[loc_dd + s] = ((old << 1) | (carry ? 1 : 0));
      carry = (old & 0x80) !== 0;
      y = (y + 1) & 0xff;
      mem8[loc_0400 + y] = carry ? 0x21 : 0x20;
    }
    // Step the write cursor back one screen row (0x28 columns) for the next snapshot byte; the stride
    // subtract's borrow-out threads into that row's first bit, exactly as the ROL chain intends.
    const beforeStride = y;
    y = (y - 0x28) & 0xff;
    carry = beforeStride >= 0x28; // the row-stride subtract's carry threads into the next row's first roll
  }

  // Draw the "no input" marker unless every input line has toggled, then run the two spine tails.
  // anyStuck is true while some input has NOT yet been seen in both states ($e4 complemented, plus the
  // never-zero and never-one accumulators) -- i.e. a stuck or unexercised line -- so a marker glyph is
  // shown until the operator has wiggled every control.
  mem8[loc_92] = 4;
  mem8[loc_91] = 0x3a;
  const anyStuck = ((mem8[loc_e4] ^ 0xff) | mem8[loc_e3] | mem8[loc_e5]) !== 0;
  writeMaskedByteAndAdvancePointer(m, anyStuck ? 0x25 : 0);

  // Two subsystem tails: tick the EAROM writeback (persists a dirty high-score block a byte per frame),
  // then re-fold the high-score checksum and publish the PRIOR fold, so the screen shows the last stable
  // value rather than a mid-update one.
  tickEaromWriteback(m);
  const [delta, oldChecksum, deltaZero] = foldHighScoreChecksum(m);
  mem8[HIGH_SCORE_CHECKSUM] = oldChecksum; // publish the prior checksum

  // Branch on whether the checksum is still moving. Nonzero delta = the table is being written, so show
  // the delta digits; zero delta = settled, so fall through to plot the actual stored score.
  if (!deltaZero) {
    // Checksum changed: plot its two digits (the digit carry rides the pointer advance of the zero plot).
    mem8[loc_91] = 0x3b;
    writeMaskedByteAndAdvancePointer(m, 0x24);
    const zeroCarry = writeMaskedByteAndAdvancePointer(m, 0); // its exit carry feeds the digit plot below
    plotByteAsTwoDigits(m, delta, zeroCarry);
    return; // end this pass; the wrapper re-runs it next frame
  }

  // Checksum stable: plot the stored score and its bonus multiple. The three packed-BCD score bytes
  // ($018d/$018c/$018b) are drawn most-significant first, the digit carry threading through each plot.
  mem8[loc_92] = 4;
  mem8[loc_91] = 0xe9;
  let c = plotByteAsTwoDigits(m, mem8[loc_018d], true);
  c = plotByteAsTwoDigits(m, mem8[loc_018c], c);
  plotByteAsTwoDigits(m, mem8[loc_018b], false);

  // Repaint the score's label row from its descriptor.
  mem8[loc_93] = 0xde;
  mem8[loc_94] = 0x3f;
  redrawPointerTableRowUnblanked(m);

  // Bonus-multiple readout. $8d holds the countdown count loc_3c97 computed; its high digit is
  // BCD-normalised and plotted, then a separator glyph (0x2e) is drawn.
  mem8[loc_92] = 5;
  mem8[loc_91] = 0x08;
  const hiDigit = decAddByte(mem8[loc_8d] >> 4, 0, 0).value; // BCD-normalise the high digit
  plotByteAsTwoDigits(m, hiDigit, true);
  writeMaskedByteAndAdvancePointer(m, 0x2e);

  // Derive the low part of the bonus multiple by tripling the low digit in BCD (add it to itself
  // twice), then saturate anything at/over 0x60 to 0x59 so the displayed value stays a valid two-digit
  // decimal, and plot it.
  let r = decAddByte(mem8[loc_8d] & 0x0f, 0, 0);
  mem8[loc_8e] = r.value;
  r = decAddByte(r.value, mem8[loc_8e], r.carry);
  mem8[loc_8e] = r.value;
  r = decAddByte(r.value, mem8[loc_8e], r.carry);
  let lowValue = r.value;
  if (lowValue >= 0x60) lowValue = 0x59;
  plotByteAsTwoDigits(m, lowValue, false);

  // Repaint the bonus row's label from its descriptor.
  mem8[loc_93] = 0xe4;
  mem8[loc_94] = 0x3f;
  redrawPointerTableRowUnblanked(m);

  // Quiesce gate: only when the three button histories ($ea/$eb/$ec) have all settled to zero does the
  // routine mark the high-score block dirty -- flip the checksum with 0xff and arm the writeback cursor
  // ($f9=0x3d, $fa=0) so tickEaromWriteback will persist the block back to NVRAM. This is the gesture
  // that commits any operator change once the controls stop moving.
  if ((mem8[loc_ea] | mem8[loc_eb] | mem8[loc_ec]) === 0) {
    mem8[HIGH_SCORE_CHECKSUM] = mem8[HIGH_SCORE_CHECKSUM] ^ 0xff;
    mem8[loc_f9] = 0x3d;
    mem8[loc_fa] = 0;
  }
  // end this pass; the wrapper re-runs it next frame
}

// The self-test input screen re-runs forever (a per-frame service loop; only the service switch, held,
// reaches here). Never returns -- this is the terminal state of the operator diagnostic; only a power
// cycle (or releasing the switch and rebooting) leaves it.
export function loc_3d57(m) {
  for (;;) selfTestInputPass(m);
}
