// SPDX-License-Identifier: GPL-3.0-only
//
// drawTileBlock2x2AtDe -- pointer-swap adapter that draws a 2x2 tile block at the DE destination.
//
// WHAT IT IS
//   A thin wrapper over drawTileBlock2x2 (ROM 0x2585) for callers whose destination cell arrives in DE
//   rather than HL. It performs the Z80 `ex de,hl`: the pointer that came in DE becomes the draw target,
//   and the old HL is handed back out in DE. It then stamps a 2x2 block (tile..tile+3) from the seed in A.
//
// ROLE IN THE MACHINE
//   The block-writer entry used when a different caller path has already staged the destination in DE.
//   drawIndexedTileBlock (ROM 0x2146) and the fallback arm of drawSelectedTileBlockOrFallback (ROM 0x213d)
//   both reach the block writer through here, which is why those selectors talk about a "pending DE
//   destination".
//
//   ROM 0x214a.  Grounding: [seen].
//
// LIVE-OUT: a 2x2 tile block written at the (former DE) cell; DE holds the former HL; returns drawTileBlock2x2's {a, hl}.
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";

export function drawTileBlock2x2AtDe(m, tile = m.regs.a, dst = m.regs.de, swapOut = m.regs.hl) {
  // ex de,hl hands the old HL back in DE, then the block draws at the pointer that arrived in DE.
  // The default args captured the pre-swap registers: dst = old DE (draw here), swapOut = old HL (into DE).
  return (m.regs.de = swapOut, drawTileBlock2x2(m, tile, dst));
}
