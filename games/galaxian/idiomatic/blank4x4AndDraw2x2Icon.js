// SPDX-License-Identifier: GPL-3.0-only

/**
 * blank4x4AndDraw2x2Icon (ROM 0x219b) — indicator "form 0": clear a 4x4 tile block, overlay a 2x2 icon.
 *
 * WHAT IT IS
 *   Blanks a 4x4 block of tilemap VRAM and then stamps a 2x2 tile icon (seeded with tile code 96) over it
 *   at the fixed VRAM address loc_51fc.
 *
 * ROLE IN THE MACHINE
 *   One of the three forms drawn by the channel-2 display-list handler draw4x4TileForm (0x215f): form 0 is
 *   this blank-then-icon, form 1 just blanks the block (blankTileBlock4x4, 0x2187), form 2 folds a
 *   complemented tile. The clear is delegated to blankTileBlock4x4 (0x2187) and the icon overlay to
 *   drawTileBlock2x2 (0x2585). It is reached only after the command queue drains a channel-2 word to its
 *   draw handler (mechanisms.md "command queue"), so the icon appears deferred rather than inline.
 *
 * ROM 0x219b.  Grounding: [seen].
 *
 * LIVE-OUT: the tilemap VRAM 4x4 region (blanked) with a 2x2 icon at loc_51fc; returns the advanced
 *   tile/pointer that drawTileBlock2x2 leaves.
 */
import { blankTileBlock4x4 } from "./blankTileBlock4x4.js";
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";
import { loc_51fc } from "./names.js";

const SEED_TILE = 96;

export function blank4x4AndDraw2x2Icon(m) {
  // Clear the 4x4 tile block first so the icon draws onto a known-blank background.
  blankTileBlock4x4(m);
  // Overlay the 2x2 icon at loc_51fc, seeded with tile 96; return the pointer drawTileBlock2x2 advances to.
  return drawTileBlock2x2(m, SEED_TILE, loc_51fc);
}
