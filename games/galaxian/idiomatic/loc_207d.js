// SPDX-License-Identifier: GPL-3.0-only
// One iteration of the object-slot walk (6 slots, stride 16). The slot pointer's low byte is a packed
// coordinate (A = L); bit 0 of the slot's flag byte (HL) selects the path -- set: the active-slot handler +
// shared loop epilogue; clear: stamp the fixed tile figure at that coordinate, then the epilogue. The layer
// never pushes, so the loop count/stride (BC) and slot pointer (HL) ride JS locals forwarded to the
// epilogue, which advances the pointer and loops back or returns once the six slots are done.
import { drawFixedTileFigureAtPackedCoord } from "./drawFixedTileFigureAtPackedCoord.js";
import { loc_2089 } from "./loc_2089.js";
import { loc_2094 } from "./loc_2094.js";

export function loc_207d(m, bc = m.regs.bc, hl = m.regs.hl) {
  const { mem8 } = m;
  const coord = hl & 0xff; // A = L: packed coord / slot index for the draw

  if (mem8[hl] & 1) {
    // active slot: hand the coord across via A, forward the saved loop state to the handler + epilogue.
    return (m.regs.a = coord, loc_2089(m, hl, bc));
  }

  drawFixedTileFigureAtPackedCoord(m, coord);
  // the draw clobbers the registers; the saved loop state rides JS locals to the shared epilogue.
  return loc_2094(m, hl, bc);
}
