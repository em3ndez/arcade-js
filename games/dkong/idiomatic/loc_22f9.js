// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f9 — store the dispatched byte into an object record as two adjacent fields:
 * the value verbatim at +0x11, and its low-bit-derived sign at +0x10 (0x00 when odd,
 * 0xFF when even). Leaf store tail of the object setup path.
 * LIVE-OUT: memory-only (record +0x10 and +0x11).
 */
import { u16 } from "../../../core/int.js";

export function loc_22f9(m, objRecord, value) {
  const { mem8 } = m;

  mem8[u16(objRecord + 0x11)] = value;
  // The byte store truncates the -1 (odd -> 0x00, even -> 0xFF).
  mem8[u16(objRecord + 0x10)] = (value & 1) - 1;
}
