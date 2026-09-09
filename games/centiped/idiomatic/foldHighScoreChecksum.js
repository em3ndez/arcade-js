// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { HIGH_SCORE_TABLE, HIGH_SCORE_CHECKSUM } from "./names.js";

/**
 * foldHighScoreChecksum -- reduce the entire high-score table down to a single-byte
 * XOR checksum, store that fresh checksum back, and report whether it changed since
 * the previous fold.
 *
 * ROLE IN THE MACHINE: Centipede keeps its high-score table in battery/EAROM-backed
 * RAM (HIGH_SCORE_TABLE, ROM $0178) so that names and scores survive a power cycle.
 * A one-byte integrity checksum (HIGH_SCORE_CHECKSUM, ROM $01b5 -- the last byte of
 * that block) guards the table against corruption and against silent edits. This
 * routine is called from the wave/round bookkeeping whenever the table might have
 * moved: it re-derives the checksum and, by returning the difference from the stored
 * one, tells the caller "did anything in the table actually change this pass?" -- the
 * cue to schedule a deferred EAROM write-back. Both cells are MAME-grounded [seen].
 *
 * MECHANISM: the fold seeds an accumulator at 0xff and XORs each of the 61 table
 * bytes (indices 0x3c..0x00, scanned high-to-low exactly as the 6502 loop does with
 * a decrementing index register) into it. XOR is order-independent and self-inverse,
 * so any single-bit flip anywhere in the table changes the final byte -- a cheap,
 * classic parity checksum. The freshly folded value then OVERWRITES the stored
 * checksum, and the routine hands back (old XOR new): that delta is zero exactly when
 * the table folds to the same value as last time (unchanged), and non-zero otherwise.
 *
 * LIVE-OUT rides the return array: A = the old^new delta (with the Z and N flags set
 * from it so the caller can branch on "changed?" / "high bit"), and Y = the OLD
 * checksum byte (preserved for the caller before it was overwritten in RAM).
 */
export function foldHighScoreChecksum(m) {
  const { mem8 } = m;
  // Seed the accumulator at 0xff (the ROM's initial checksum seed), then XOR every
  // byte of the 62-entry high-score block into it. Scanning 0x3c down to 0 mirrors the
  // original's decrement-and-branch loop; XOR's order-independence makes direction moot.
  let acc = 0xff;
  for (let i = 0x3c; i >= 0; i--) {
    acc = u8(acc ^ mem8[HIGH_SCORE_TABLE + i]);
  }
  // Snapshot the PREVIOUS checksum before clobbering it -- it is both the comparison
  // basis and the Y live-out the caller wants.
  const oldChecksum = mem8[HIGH_SCORE_CHECKSUM];
  mem8[HIGH_SCORE_CHECKSUM] = acc;                       // publish the fresh fold
  // The XOR of old and new is the "did the table change" signal: zero == identical.
  const delta = u8(oldChecksum ^ acc);
  // Return A=delta (Z/N flags mirror it for the caller's branch) and Y=old checksum.
  return [(m.regs.a = delta), (m.regs.y = oldChecksum), (m.regs.fZ = delta === 0), (m.regs.fN = (delta & 0x80) !== 0)];
}
