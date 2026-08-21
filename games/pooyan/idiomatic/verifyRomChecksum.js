// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ROM_CHECKSUM_TOP, TAMPER_STRIKES_STATE10 } from "./names.js";
/**
 * verifyRomChecksum — the state-10 image-integrity guard. Sum 16 read-only program bytes descending
 * from the top of the checksum block into a byte, then read its shape: a healthy image has bit0 clear,
 * bit5 set and bit7 set, and the guard returns untouched. Any deviation bumps a tamper counter.
 *
 * A leaf: reads a fixed block of read-only program data, calls nothing.
 *
 * LIVE-OUT: memory only — the tamper counter, incremented only on a checksum deviation.
 */
const CHECKSUM_BYTES = 16;

export function verifyRomChecksum(m) {
  const { mem8 } = m;

  let sum = 0;
  let addr = ROM_CHECKSUM_TOP;
  for (let i = 0; i < CHECKSUM_BYTES; i++) {
    sum = (sum + mem8[addr]) & 0xff;
    addr = u16(addr - 1);
  }

  // Healthy image: bit0 clear, bit5 set, bit7 set. Any other shape is tampering.
  const healthy = (sum & 0x01) === 0 && (sum & 0x20) !== 0 && (sum & 0x80) !== 0;
  if (healthy) return;

  mem8[TAMPER_STRIKES_STATE10] = mem8[TAMPER_STRIKES_STATE10] + 1;
}
