// SPDX-License-Identifier: GPL-3.0-only
import { loc_7f5d } from "./loc_7f5d.js";
import { loc_7fa8 } from "./loc_7fa8.js";
import {
  loc_8e21,
  loc_8e23,
  loc_8e24,
  loc_8e27,
  loc_8e2b,
} from "./names.js";

/**
 * loc_7f0e — write-anim dispatch entry 1, driven from the animation work-block (no register input).
 *
 * Decrements a 16-bit down-counter; at zero it hands off to the shared tail. Otherwise a flag byte
 * selects the index direction (bit 3 set steps DOWN and wraps at the low bound; bit 3 clear + bit 2
 * set steps UP and wraps at the high bound; bit 3 clear + bit 2 clear tails into the append handler
 * with no step). An index step first ticks a reload sub-timer, returning while it still counts, then
 * stores the stepped index through the destination pointer and falls into the append handler.
 *
 * LIVE-OUT: memory only; the register file is scratch.
 */


const RELOAD_VALUE = 0x0c; //     value the reload sub-timer is re-seeded to on expiry
const INDEX_LO = 0x10; //         low index bound; a DOWN step below it wraps to INDEX_HI
const INDEX_HI = 0x2c; //         high index bound; an UP step above it wraps to INDEX_LO

export function loc_7f0e(m) {
  const { mem8 } = m;

  // Decrement the 16-bit counter; when it drains to zero, hand off to the shared tail.
  const counter = ((mem8[loc_8e2b] | (mem8[loc_8e2b + 1] << 8)) - 1) & 0xffff;
  mem8[loc_8e2b] = counter & 0xff;
  mem8[loc_8e2b + 1] = (counter >> 8) & 0xff;
  if (counter === 0) return loc_7fa8(m);

  // The flag byte pointed to by the source pointer selects the index direction.
  const flags = mem8[mem8[loc_8e21] | (mem8[loc_8e21 + 1] << 8)];

  if (flags & 0x08) {
    // bit 3 set: index counts DOWN
    mem8[loc_8e24] = mem8[loc_8e24] - 1;
    if (mem8[loc_8e24] !== 0) return;
    mem8[loc_8e24] = RELOAD_VALUE;
    mem8[loc_8e23] = mem8[loc_8e23] - 1;
    if (mem8[loc_8e23] < INDEX_LO) mem8[loc_8e23] = INDEX_HI; // wrap up past the low bound
  } else if ((flags & 0x04) === 0) {
    // bit 3 clear, bit 2 clear: tail into the append handler (no index step)
    return loc_7f5d(m);
  } else {
    // bit 3 clear, bit 2 set: index counts UP
    mem8[loc_8e24] = mem8[loc_8e24] - 1;
    if (mem8[loc_8e24] !== 0) return;
    mem8[loc_8e24] = RELOAD_VALUE;
    mem8[loc_8e23] = mem8[loc_8e23] + 1;
    if (mem8[loc_8e23] > INDEX_HI) mem8[loc_8e23] = INDEX_LO; // wrap down past the high bound
  }

  // Store the stepped index byte through the destination pointer, then fall into the append handler.
  const dest = mem8[loc_8e27] | (mem8[loc_8e27 + 1] << 8);
  mem8[dest] = mem8[loc_8e23];
  return loc_7f5d(m);
}
