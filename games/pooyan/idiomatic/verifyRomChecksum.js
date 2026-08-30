// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ROM_CHECKSUM_TOP, TAMPER_STRIKES_STATE10 } from "./names.js";
/**
 * verifyRomChecksum — the state-10 program-image integrity guard.
 *
 * ROM 0x3fe9. Grounding: [seen].
 *
 * This is one of the game's several anti-tamper self-checks — the handler the machine runs
 * for object state 10. It fingerprints a fixed 16-byte block of the read-only program image
 * and confirms the fingerprint still has the expected shape; a bootleg or patched ROM whose
 * bytes have drifted produces a different fingerprint and gets caught here.
 *
 * The check sums 16 bytes DESCENDING from the top of the checksum block, ROM_CHECKSUM_TOP
 * (0x7780), folding them into a single 8-bit accumulator (the carry out of each add is
 * discarded — an ordinary byte sum with wrap). The genuine image is arranged so that the
 * resulting byte has a specific bit signature: bit0 clear, bit5 set, bit7 set. That exact
 * pattern is the "healthy" answer and the guard returns having touched nothing.
 *
 * Any deviation — bit0 set, OR bit5 clear, OR bit7 clear — means the summed bytes are not the
 * originals, so the guard bumps a tamper counter (TAMPER_STRIKES_STATE10, 0x8a39) that the
 * anti-tamper machinery elsewhere reads to degrade or brick the bootleg.
 *
 * A leaf: reads a fixed block of read-only program data, calls nothing.
 *
 * LIVE-OUT: memory only — the tamper counter, incremented only on a checksum deviation.
 */
const CHECKSUM_BYTES = 16;

export function verifyRomChecksum(m) {
  const { mem8 } = m;

  // Fold 16 program bytes into one, walking DOWNWARD from ROM_CHECKSUM_TOP (0x7780). Each add
  // is taken 8-bit (& 0xff), so it is a byte sum with wrap; the address decrements with 16-bit
  // wrap. The bytes read are read-only program image, so the sum is fixed for a genuine ROM.
  let sum = 0;
  let addr = ROM_CHECKSUM_TOP;
  for (let i = 0; i < CHECKSUM_BYTES; i++) {
    sum = (sum + mem8[addr]) & 0xff;
    addr = u16(addr - 1);
  }

  // The genuine image's checksum byte has bit0 clear, bit5 set and bit7 set. Exactly that
  // signature is "healthy"; on a match the guard returns without recording anything.
  const healthy = (sum & 0x01) === 0 && (sum & 0x20) !== 0 && (sum & 0x80) !== 0;
  if (healthy) return;

  // Any other shape means the program bytes have been altered — bump the tamper counter at
  // TAMPER_STRIKES_STATE10 (0x8a39) that the anti-tamper response reads.
  mem8[TAMPER_STRIKES_STATE10] = mem8[TAMPER_STRIKES_STATE10] + 1;
}
