// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SIGNATURE_SAMPLE_BASE, SIGNATURE_REFERENCE_TABLE, SIGNATURE_MISMATCH_FLAG } from "./names.js";
/**
 * verifyRomSignature — anti-tamper program-signature check.
 *
 * Compares the 16-byte reference table against every eighth byte of the sampled code
 * region (sample pointer += 8 per step, reference += 1). On the first byte that differs it
 * raises the mismatch flag and stops; a clean pass leaves the flag untouched. Reads the
 * program image, writes the flag; calls nothing.
 *
 * LIVE-OUT: memory only — sets SIGNATURE_MISMATCH_FLAG to 1 on a mismatch, else nothing.
 */
export function verifyRomSignature(m) {
  const { mem8 } = m;
  let sample = SIGNATURE_SAMPLE_BASE;
  let ref = SIGNATURE_REFERENCE_TABLE;

  for (let i = 0x10; i !== 0; i--) {
    if (mem8[ref] !== mem8[sample]) {
      mem8[SIGNATURE_MISMATCH_FLAG] = 1;
      return;
    }
    ref = u16(ref + 1);
    sample = u16(sample + 8);
  }
}
