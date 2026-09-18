// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00ca — dispatch a computed jump-table target back into a call.
 * DK routes most per-frame control flow through inline jump tables: a caller loads a selector and
 * a shared trampoline jumps to the little-endian target word beside the code. This is the far end.
 * The listed targets are a whitelist, not a range check — the game has neither: a selector that
 * walks off its table or picks a zero slot would dispatch plausible-looking garbage, so refusing
 * names it. The tables' null slots are the out-of-range case and are deliberately absent below.
 * LIVE-OUT: the dispatched handler's return value, forwarded — the difficulty guards among the
 * targets return a keep-going boolean their caller consumes as an early return.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";

// Every target the wired inline jump tables vector to; one reached by two tables is listed once.
const DISPATCH_TARGETS = new Set([
  0x01c3, 0x073c, 0x08b2, 0x06fe,
  0x0986, 0x09ab, 0x09d6, 0x09fe, 0x0a1b, 0x0a37, 0x0a63, 0x0a76, 0x0bda, 0x0c91, 0x123c, 0x127c,
  0x12f2, 0x1344, 0x138f, 0x13a1, 0x13aa, 0x13bb, 0x141e, 0x1486, 0x1615, 0x196b, 0x197a,
  0x0763, 0x0779, 0x07c3, 0x07cb, 0x084b, 0x1977,
  0x08ba, 0x08f8,
  0x0a8a, 0x0abf, 0x0ae8, 0x0b06, 0x0b68, 0x0bb3, 0x3069,
  0x128b, 0x12ac, 0x12de,
  0x1654, 0x1670, 0x168a, 0x16a3, 0x16bb, 0x1732, 0x1757, 0x178e,
  0x17b6, 0x1839, 0x186f, 0x1880, 0x18c6,
  0x2880, 0x28b0, 0x28e0, 0x2901,
  0x3110, 0x311b, 0x3126, 0x3131,
  0x3e99,
]);

export function loc_00ca(m, target, site = "0x00CA (NMI game state)") {
  // A rewritten handler is invoked directly, not through the routine table: that is how the
  // call-bracket seam recognises a computed dispatch. Going through the table would open a frame
  // this dispatch never opened, and the seam would balance a bracket that is not there.
  if (m.overrides && m.overrides.has(target)) return m.overrides.get(target)(m);

  if (DISPATCH_TARGETS.has(target)) return m.call(target);

  throw new NotImplemented(
    `handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(reached via rst 0x28 table at ${site})`,
  );
}
