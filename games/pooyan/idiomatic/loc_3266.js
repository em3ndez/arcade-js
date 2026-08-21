// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FORMATION_GUARD_BASE } from "./names.js";
/**
 * loc_3266 — hunter-formation dispatch state 2: a code self-check. Sum a fixed block of program bytes
 * from FORMATION_GUARD_BASE upward; an intact image sums to the sentinel and the routine returns to
 * the shared epilogue. Any other sum means the block is corrupt, which the frozen code answered by
 * re-entering the guarded region — modelled here as a thrown integrity trap (unreachable with a valid image).
 *
 * LIVE-OUT: none — reads constant data only, writes no RAM, and its caller consumes no register or flag.
 */
const GUARD_BLOCK_LEN = 0x20; // bytes summed
const GUARD_SENTINEL = 0xdc; // sum a valid image produces

export function loc_3266(m) {
  const { mem8 } = m;
  let sum = 0;
  let p = FORMATION_GUARD_BASE;
  for (let i = 0; i < GUARD_BLOCK_LEN; i++) {
    sum = (sum + mem8[p]) & 0xff;
    p = u16(p + 1);
  }
  if (sum !== GUARD_SENTINEL) {
    throw new Error("loc_3266: ROM-integrity/sanity trap unreachable with a valid ROM");
  }
}
