// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SIGNATURE_SAMPLE_BASE, SIGNATURE_REFERENCE_TABLE, SIGNATURE_MISMATCH_FLAG } from "./names.js";
/**
 * verifyRomSignature — anti-tamper program-signature check. ROM 0x208c. [seen]
 *
 * One half of the board's self-test: a spot-check that the running program image is the
 * genuine, unmodified code and not a bootleg or a corrupted dump. Rather than sum the whole
 * ROM, it takes a cheap fingerprint — it reads a fixed 16-byte reference table baked into the
 * program (SIGNATURE_REFERENCE_TABLE, 0x20aa) and compares it, byte for byte, against a SPARSE
 * sample of the code region: it starts at SIGNATURE_SAMPLE_BASE (0x066d) and steps the sample
 * pointer forward by 8 each time while the reference pointer advances by 1. So the sixteen
 * bytes at 0x066d, 0x0675, 0x067d, … must equal the sixteen reference bytes in order. Sampling
 * every eighth byte spreads the check across a 128-byte swath of code for the price of only
 * sixteen comparisons — enough that a tampered image is overwhelmingly likely to trip it.
 *
 * On the FIRST byte that differs it raises SIGNATURE_MISMATCH_FLAG (0x8ef0) and returns
 * immediately; a clean pass through all sixteen leaves the flag untouched (the caller clears
 * it beforehand). The flag is what the surrounding self-test state reads to decide whether to
 * proceed into gameplay or wedge the board. This routine only reads the program image and
 * writes the one flag; it calls nothing.
 *
 * LIVE-OUT: memory only — sets SIGNATURE_MISMATCH_FLAG to 1 on a mismatch, else nothing.
 */
export function verifyRomSignature(m) {
  const { mem8 } = m;
  // sample walks the sparse code region (every 8th byte); ref walks the packed 16-byte table.
  let sample = SIGNATURE_SAMPLE_BASE;
  let ref = SIGNATURE_REFERENCE_TABLE;

  // Sixteen reference bytes to match. Bail the instant one disagrees.
  for (let i = 0x10; i !== 0; i--) {
    if (mem8[ref] !== mem8[sample]) {
      // Fingerprint diverged: the image is not the trusted ROM. Trip the flag and stop —
      // the self-test state that owns this cell will refuse to hand control to gameplay.
      mem8[SIGNATURE_MISMATCH_FLAG] = 1;
      return;
    }
    // Advance both cursors: reference is contiguous (+1), the sample skips by 8 so the
    // sixteen probes fan out across a 128-byte stretch of code. 16-bit wrap on each.
    ref = u16(ref + 1);
    sample = u16(sample + 8);
  }
  // Fell through all sixteen with no divergence: the image is trusted, flag left as the
  // caller pre-cleared it.
}
