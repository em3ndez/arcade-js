// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFrogByColumn  —  ROM 0x06a2  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The dispatcher for Frogger's board-complete "all frogs home" reveal. When the last of the five home
 *   bays is filled the board is won, and the machine plays a short left-to-right flourish that drops a
 *   frog into each home in turn before resetting the bays and awarding a life. This routine paints one
 *   frame of that flourish: given a single "column selector" byte, it either stamps ONE bay's completed-
 *   frog graphic, refills every bay and awards the life, or does nothing at all.
 *
 * WHERE IT SITS
 *   Called once per in-play frame from the NMI service tree (serviceVblankNmi, ROM 0x0066), but only
 *   during the reveal. The selector it dispatches on is HOME_REVEAL_COUNTDOWN (0x8297): the board-complete
 *   handler loc_05d3 seeds that cell to 255, and once the reveal delay HOME_REVEAL_DELAY_TIMER (0x8298)
 *   has drained from 64, the service tree decrements the countdown by one per frame and hands its current
 *   value in as the selector here. So this routine sees the countdown sweep 255 → 0, and the reveal is
 *   spelled out entirely by WHICH countdown values happen to line up with a bay's fixed column number.
 *   On the great majority of frames the value sits between thresholds and this routine writes nothing.
 *
 * LIVE-OUT
 *   Memory only. It stamps VRAM tile cells (and, on the fill-all arm, hands off to a tail that also bumps
 *   a life count). It returns nothing and leaves no register the caller reads.
 */
import { HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM } from "./names.js";
import { fillAllHomeSlotsAndAwardLife } from "./fillAllHomeSlotsAndAwardLife.js";

// One screen row of the tilemap is 32 tile cells, so +32 from a cell steps straight down one row — the
// stride used to place the bottom half of each 2x2 stamp below its top half.
const ROW_STRIDE = 32;

// The completed-frog "in home" graphic is a 2x2 block of four consecutive tiles 252..255 (0xFC..0xFF):
// 252,253 across the top row and 254,255 across the bottom. FROG_TILE is the first of the four.
const FROG_TILE = 252;

// The reveal's bay schedule: each selector value is a bay's fixed "column number", mapped to that bay's
// VRAM base. The values descend 192,144,112,80,48 (0xC0,0x90,0x70,0x50,0x30) — so as HOME_REVEAL_COUNTDOWN
// sweeps DOWN from 255 it hits 192 first (bay 1), then 144 (bay 2) … then 48 (bay 5), dropping a frog into
// each home in left-to-right order. The destination bases run the other way: HOME_SLOT1_VRAM (0xab64) is
// the highest address and HOME_SLOT5_VRAM (0xa864) the lowest, i.e. the bases DESCEND as the bay index
// rises. Only these exact values stamp a bay; every other countdown value falls through as a no-op.
const BAY_BASE_BY_COLUMN = new Map([
  [192, HOME_SLOT1_VRAM],
  [144, HOME_SLOT2_VRAM],
  [112, HOME_SLOT3_VRAM],
  [80, HOME_SLOT4_VRAM],
  [48, HOME_SLOT5_VRAM],
]);

// The final selector, reached when the countdown has passed all five bays down to 16 (0x10). It does not
// stamp a bay here; it hands off to fillAllHomeSlotsAndAwardLife (ROM 0x0670), which refills all five bays
// with the empty-home tile (0x10), clears HOME_COLUMN_STATE (0x842f), and awards the extra life — closing
// the board.
const FILL_ALL_COLUMN = 16;

export function stampHomeBayFrogByColumn(m, homeColumn = m.regs.a) {
  // Exact-match dispatch on the column selector (defaulting to register A, as the ROM reads it). One of
  // the five bay thresholds → reveal that bay's frog; the fill-all threshold → close the board via the
  // tail; anything else (the common between-thresholds case) → fall out having written nothing.
  const base = BAY_BASE_BY_COLUMN.get(homeColumn);
  if (base !== undefined) return stampBayFrog(m, base);
  if (homeColumn === FILL_ALL_COLUMN) return fillAllHomeSlotsAndAwardLife(m);
}

// Stamp one bay's completed-frog 2x2 graphic into VRAM at `base`: tiles 252,253 across the top row
// (base, base+1) and 254,255 across the bottom row one screen row below (base+32, base+33). Those four
// tile cells are what the player sees appear as that home's frog during the reveal.
function stampBayFrog(m, base) {
  const { mem8 } = m;
  mem8[base] = FROG_TILE;
  mem8[base + 1] = FROG_TILE + 1;
  mem8[base + ROW_STRIDE] = FROG_TILE + 2;
  mem8[base + ROW_STRIDE + 1] = FROG_TILE + 3;
}
