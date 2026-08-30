// SPDX-License-Identifier: GPL-3.0-only
/**
 * binToPackedBcd — turn a plain binary count into decimal display digits: the low two digits packed
 * into one byte, plus a separate hundreds tally.
 *
 * ROM 0x1131-0x113b. [seen].
 *
 * The hardware has no binary->decimal instruction, so a count that must be SHOWN on the HUD is
 * converted by counting up. The routine starts from zero and increments a running total `count` times
 * in packed BCD (the Z80 pattern add-1-then-DAA), which keeps each nibble a valid decimal digit and
 * rolls 0x99 over to 0x00. The low two digits are exactly `count mod 100` and land packed in A ready
 * to draw as a two-digit field; each 0x99->0x00 rollover is the hundreds carry, tallied separately
 * into C as `count div 100`.
 *
 * Edge case, inherited from the ROM's post-tested loop: a count of 0 on entry is not zero passes but
 * a full wrap of 256, because the exit test runs after each pass. That yields A = 0x56 (256 mod 100,
 * packed) and hundreds = 2 (256 div 100).
 *
 * A leaf that touches no memory — a pure register transform.
 *
 * LIVE-OUT: A (the packed-BCD low two digits, drawn as a 2-digit HUD field) and C (the hundreds
 * count, folded into the hundreds slot); both are consumed by the caller. Returned as { a, hundreds }.
 */
export function binToPackedBcd(m, count = m.regs.b) {
  // Post-tested loop in the ROM: a zero counter counts a full wrap (256 passes), not zero.
  const iters = count === 0 ? 256 : count;

  // Low two decimal digits (count mod 100), packed one digit per nibble the way the BCD add leaves
  // them: tens in the high nibble, units in the low nibble.
  const low = iters % 100;
  const a = (Math.floor(low / 10) << 4) | (low % 10);

  // Hundreds carry: one per 0x99->0x00 rollover the BCD add would produce, i.e. count div 100.
  const hundreds = Math.floor(iters / 100);

  return { a: (m.regs.a = a), hundreds: (m.regs.c = hundreds) };
}
