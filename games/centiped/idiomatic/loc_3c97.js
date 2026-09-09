// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_0400, loc_0500, loc_0600, loc_0700, loc_54, loc_64,
  loc_8b, loc_8c, loc_8d, loc_8e, loc_8f, loc_90, loc_91, loc_92, loc_93, loc_94,
  loc_d5, loc_e3, loc_e5, loc_018b, loc_018c, loc_018d,
  POKEY_RANDOM, SKCTL, loc_1c03, loc_1c04, WATCHDOG,
} from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
import { loadHighScoreTableFromEarom } from "./loadHighScoreTableFromEarom.js";
import { loc_3d57 } from "./loc_3d57.js";

// One packed-BCD subtract byte in NMOS 6502 style: the VALUE is decimal-corrected, but the carry-out and
// N flag come from the plain binary subtraction (that is what a multi-byte chain threads/tests). [code]
// The 6502 SBC in decimal mode is a notorious quirk: it produces a BCD result byte, yet the C and N
// flags it sets are the BINARY ones. A multi-byte BCD chain reads C to thread the borrow between bytes
// and tests N for the final sign, so faithfully reproducing both is what keeps the countdown below
// terminating on the same iteration the silicon does.
function decSubByte(a, v, carryIn) {
  // 6502 carry convention: carry-set means "no borrow", so the borrow into this byte is 1 - carryIn.
  const borrow = 1 - carryIn;
  // Plain binary subtract first -- this is the value the C and N flags are derived from.
  const diff = a - v - borrow;
  const carry = diff >= 0 ? 1 : 0;      // binary borrow-out (C)
  const negative = (diff & 0x80) !== 0; // binary sign (N)
  // Now the decimal correction, nibble by nibble: fix the low nibble, borrowing 6 if it went negative,
  // then the high nibble, dropping 0x60 if the whole subtraction underflowed a decimal decade.
  let low = (a & 0x0f) - (v & 0x0f) - borrow;
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let sum = (a & 0xf0) - (v & 0xf0) + low;
  if (sum < 0) sum -= 0x60;
  return { value: sum & 0xff, carry, negative };
}

/**
 * loc_3c97 (ROM 0x3c97) — the operator self-test CHECKSUM screen, one of two diagnostic screens the board
 * shows only while the service switch is held (a normal boot never reaches here). selfTestChecksumPass is
 * the single build of that screen; the loc_3c97 wrapper runs it then drops into the never-returning
 * input-test loop.
 *
 * What the pass does, in order: (1) re-clears the work/video/object pages so the screen starts blank;
 * (2) seeds the $54/$64 object rows with a fill pattern; (3) reads the POKEY RNG twice (they XOR to zero
 * on the clock-free layer); (4) folds each 2KB program-ROM bank into a one-byte XOR checksum and plots the
 * four results through the draw cursor, so an operator can compare them against the known-good label on the
 * cabinet; (5) reloads the high-score mirror straight out of NVRAM; (6) copies the 7-byte score header down
 * into the $8e work row and runs a packed-BCD countdown that repeatedly subtracts it from an accumulator,
 * landing the iteration count in $8d (this becomes the bonus-multiple readout on the next screen).
 * Live-out: pages 0/4/5/6 cleared, page 7 = index; the four checksums plotted; $8d = countdown count. [code]
 */
export function selfTestChecksumPass(m) {
  const { mem8, mem16 } = m;

  // Re-clear zeropage and pages 4/5/6; fill page 7 with its own index. One descending index sweeps all
  // five pages at once (the 6502 does this with a single X loop). Page 7 gets its own index as a marker.
  for (let x = 0; ; x = (x + 1) & 0xff) {
    mem8[loc_0700 + x] = x;
    mem8[(loc_00 + x) & 0xff] = 0;
    mem8[loc_0400 + x] = 0;
    mem8[loc_0500 + x] = 0;
    mem8[loc_0600 + x] = 0;
    if (((x + 1) & 0xff) === 0) break;
  }
  // Preset two diagnostic accumulators to 0xff and clear a pair of LS259 output-latch cells so the
  // hardware side of the test starts from a defined state.
  mem8[loc_d5] = 0xff;
  mem8[loc_e3] = 0xff;
  mem8[loc_1c03] = 0;
  mem8[loc_1c04] = 0;

  // Seed the $54/$64 rows to index | 0x80. Setting bit7 tags every object slot as "present" so the
  // shadow/draw machinery paints the full grid of test glyphs.
  for (let x = 0x0f; x >= 0; x--) {
    const v = x | 0x80;
    mem8[(loc_54 + x) & 0xff] = v;
    mem8[(loc_64 + x) & 0xff] = v;
  }

  // Two RNG reads XOR to zero (clock-free layer holds the poly counter constant). The hardware POKEY
  // poly counter advances with the CPU clock; the clock-free idiomatic layer holds it fixed, so reading
  // it twice and XORing cancels to 0 -- matching what the silicon happens to produce here. SKCTL=3
  // re-enables the keyboard/pot scan the test needs.
  mem8[loc_e5] = mem8[POKEY_RANDOM] ^ mem8[POKEY_RANDOM];
  mem8[SKCTL] = 3;

  // Fold each 2KB program bank into a one-byte checksum: XOR 8 pages, push, reset the accumulator.
  // $8b/$8c form a 16-bit page pointer (lo held at 0, hi = the page number) walked across program ROM.
  mem8[loc_8b] = 0;
  mem8[loc_8c] = 0x20;
  const checksums = [];
  let acc = 0xff;
  // Walk 32 pages (0x20..0x3f) most-recent-first. Each page XORs its 256 bytes into acc; every 8th
  // page is a 2KB bank boundary where the running fold is published and the accumulator re-seeded.
  for (let bank = 0x1f; bank >= 0; bank--) {
    // Kick the watchdog each page (writing anything to $2000) so the long fold does not trip a reset.
    mem8[WATCHDOG] = bank; // watchdog kick
    // XOR all 256 bytes of this page into the accumulator.
    for (let y = 0; ; y = (y + 1) & 0xff) {
      acc ^= mem8[(mem16[loc_8b] + y)];
      if (((y + 1) & 0xff) === 0) break;
    }
    if ((bank & 0x07) === 0) { checksums.push(acc); acc = 0xff; } // bank boundary: publish and reset
    // Advance the pointer's high byte to the next page.
    mem8[loc_8c] = (mem8[loc_8c] + 1);
  }

  // Plot the four bank checksums (skipping any that folded to zero) through the ($91) draw cursor. Each
  // one is preceded by its bank label glyph (x | 0x20) so the operator can read which bank is which.
  mem8[loc_92] = 4;
  for (let x = 3; x >= 0; x--) {
    mem8[loc_91] = x ^ 0x3f;
    const checksum = checksums.pop();
    if (checksum === 0) continue;
    writeMaskedByteAndAdvancePointer(m, x | 0x20);
    writeMaskedByteAndAdvancePointer(m, 0);
    plotByteAsTwoDigits(m, checksum, false);
  }

  // Reload the high-score mirror out of NVRAM so the screen can show the stored score below.
  loadHighScoreTableFromEarom(m, 0); // A live-in is a don't-care; the NVRAM read overwrites it

  // Copy the 7-byte high-score header down into the $8e work row -- the countdown below consumes it.
  for (let y = 6; y >= 0; y--) mem8[loc_8e + y] = mem8[loc_018b + y];

  // Packed-BCD countdown: repeatedly subtract the $8e.. value from the $91.. accumulator until it goes
  // negative, counting iterations in Y. A zero header skips the loop and leaves Y at its post-copy value.
  let y = 0xff;
  // Guard: a wholly zero header would never underflow, so the loop is skipped and Y keeps its
  // post-copy value. Only a nonzero score header runs the countdown.
  if ((mem8[loc_018b] | mem8[loc_018c] | mem8[loc_018d]) !== 0) {
    y = 0;
    for (;;) {
      // Count this iteration; a wrap back to 0 (256 subtractions) is a hard safety stop.
      y = (y + 1) & 0xff;
      if (y === 0) break;
      // One multi-byte BCD subtract of the header ($8e..) from the accumulator ($91..), threading the
      // borrow (carry) up through the four bytes. Carry starts set (= no borrow) per 6502 SBC.
      let carry = 1;
      let r;
      r = decSubByte(mem8[loc_91], mem8[loc_8e], carry); mem8[loc_91] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_92], mem8[loc_8f], carry); mem8[loc_92] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_93], mem8[loc_90], carry); mem8[loc_93] = r.value; carry = r.carry;
      r = decSubByte(mem8[loc_94], 0, carry); mem8[loc_94] = r.value;
      // The accumulator has gone negative (N set on the top byte): the score is spent, stop counting.
      if (r.negative) break;
    }
  }
  // Publish the iteration count -- how many times the header divided into the accumulator, i.e. the
  // bonus-life multiple the next screen displays.
  mem8[loc_8d] = y;
}

// Run the checksum pass, then fall into the input-test screen (the non-returning service loop). This
// is the wrapper the ROUTINES map dispatches for 0x3c97; the checksum screen flows straight into the
// input screen the way the original ROM does.
export function loc_3c97(m) {
  selfTestChecksumPass(m);
  return loc_3d57(m);
}
