// SPDX-License-Identifier: GPL-3.0-only
// Advance the pointer's low byte in-page, bump the byte it now names, then reseed the strided
// shadow field from its fixed source.
import { seedObjectShadowFromRom } from "./seedObjectShadowFromRom.js";

export function advanceSequenceStateAndReseedObjectShadow(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  const nextLow = (ptr + 1) & 0xff;            // advance low byte
  const next = (ptr - (ptr & 0xff)) + nextLow; // stay in page
  mem8[next]++;                                 // bump the counted byte (wraps 255 -> 0)
  seedObjectShadowFromRom(m);
}
