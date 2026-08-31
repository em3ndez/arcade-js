// SPDX-License-Identifier: GPL-3.0-only
import { seedTileFillCursor } from "./seedTileFillCursor.js";
import { PLAYFIELD_TILE_BASE } from "./names.js";
/**
 * armTileFillFromPlayfieldBase — arm the row-by-row tilemap fill starting from the fixed
 * top of the playfield tile plane.
 *
 * WHAT IT IS
 *   A tiny entry point into the tile clear/fill machinery. The screen background is a
 *   32x32 grid of cells, and the tile-code for every cell lives in the video-RAM plane
 *   at 0x8400-0x87FF (one byte per cell). To wipe or repaint that whole grid the machine
 *   runs a fill loop that walks a write cursor down the plane one row at a time. Before
 *   that loop can run, two pieces of state must be set up: WHERE the first write lands
 *   (the write cursor) and HOW MANY rows remain (the row counter). This routine is the
 *   "reset to the fixed start" way of arming that setup.
 *
 * ROLE IN THE MACHINE
 *   Two arming entry points exist that differ only in where they park the cursor. This
 *   one (ROM 0x02e3) hard-wires the cursor to PLAYFIELD_TILE_BASE (0x8402), the fixed
 *   top-left of the playfield tile plane, so the ensuing fill covers the grid from the
 *   very top. The board-build variant instead seats the cursor lower in the plane for a
 *   shorter run. Both then share the exact same arming code, so the only thing that sets
 *   this variant apart is the start address chosen here.
 *
 * HOW THE HARDWARE REACHES THE ARMING CODE
 *   At ROM 0x02e3 the machine loads its 16-bit pointer register with 0x8402, then runs
 *   straight on into the shared arming code at 0x02e6 (seedTileFillCursor) with that
 *   address already in hand — seating the fixed start is the whole contribution of this
 *   entry point.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT
 *   - A = 0x20 (32) — the seeded row count. The shared arming code leaves the full grid
 *     height in A, and the caller feeds it straight into the hardware watchdog kick.
 *   - TILE_FILL_PTR (0x880b) = 0x8402 — the write cursor the fill loop will advance.
 *   - FILL_ROW_COUNTER (0x8809) = 0x20 — rows remaining, the full grid height.
 */
export function armTileFillFromPlayfieldBase(m) {
  // Hand the shared arming code the fixed playfield tile-plane start (0x8402) as the
  // write-cursor seed. That code stores this pointer into TILE_FILL_PTR (0x880b), seeds
  // FILL_ROW_COUNTER (0x8809) to the full 0x20 (32) rows, and returns with the row count
  // in A for the caller's watchdog kick. Choosing the fixed base here is what makes this
  // the reset-to-top variant; the arming work itself is identical for both entry points.
  return seedTileFillCursor(m, PLAYFIELD_TILE_BASE);
}
