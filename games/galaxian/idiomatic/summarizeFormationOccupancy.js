// SPDX-License-Identifier: GPL-3.0-only
import {
  OCCUPANCY_GRID, ROW_OCCUPANCY, COLUMN_OCCUPANCY, FORMATION_X_BOUNDS,
  OBJ_TABLE, loc_42b1, loc_4220, loc_4221, loc_4225, loc_4226,
} from "./names.js";

const ROWS = 6;
const COLS = 10;
const GRID_ROW_STRIDE = 16; // grid rows sit 16 bytes apart
const ROW_GUARD = 2;        // leading always-empty rows of the row table
const COL_GUARD = 3;        // leading always-empty columns of the column table

const FROM_RIGHT_BASE = 34;  // bound scanned from the rightmost column, stepped inward
const FROM_LEFT_BASE = 224;  // bound scanned from the leftmost column, stepped inward
const COLUMN_PITCH = 16;     // X step per skipped column

const OBJ_STRIDE = 32;   // bytes per object-table slot
const CLEAR_TOGGLE = 1;  // flips bit0 (any-occupied) into a region-clear flag

// Address of occupancy cell (row r, col c): the grid sits at OCCUPANCY_GRID (0x4123) with rows a
// GRID_ROW_STRIDE (16) apart, so cell (r,c) is OCCUPANCY_GRID + r*16 + c.
const gridCell = (r, c) => OCCUPANCY_GRID + r * GRID_ROW_STRIDE + c;
// Address of the per-column OR summary for column c, which lives behind COL_GUARD (3) guard cells.
const columnOr = (c) => COLUMN_OCCUPANCY + COL_GUARD + c;

/**
 * summarizeFormationOccupancy (ROM 0x098e) -- fold the formation occupancy grid into its summaries.
 *
 * WHAT IT IS
 *   The enemy formation is tracked as a 6-row x 10-column occupancy grid (the occupancy lane of the object
 *   grid at OCCUPANCY_GRID, 0x4123). Once per formation-prep tick this routine reduces that grid into the
 *   cheap summary cells the rest of the field consults, so downstream code never has to walk all 60 cells:
 *     - per-row ORs into ROW_OCCUPANCY (0x41e8), behind 2 always-empty guard cells,
 *     - per-column ORs into COLUMN_OCCUPANCY (0x41f0), behind 3 guard cells,
 *     - the horizontal extent of the surviving block, as a bound pair packed into FORMATION_X_BOUNDS
 *       (0x4210), scanned inward from each end,
 *     - and four region-"clear" flags (loc_4221/loc_4220 from the rows, loc_4226/loc_4225 from two
 *       object-table columns), each stored as OR XOR 1 so bit0 set means "that region is empty".
 *
 * ROLE IN THE MACHINE
 *   Called every frame during formation prep by the attract loop and both play-frame handlers (see
 *   mechanisms.md "Object / occupancy grid ..."). The clear flags gate launching, pacing, stage-advance,
 *   and the shot pipeline; the X bounds give the sweep oscillator its horizontal limits; and the same grid
 *   separately feeds the marching-hum audio (driveSoundVoicesFromOccupancy), which thins as the block does.
 *
 * Grounding: [seen] (names.js ROUTINES 0x098e).
 *
 * LIVE-OUT: memory only. Writes ROW_OCCUPANCY (8 cells), COLUMN_OCCUPANCY (13 cells), FORMATION_X_BOUNDS
 *   (16-bit), and the four clear flags loc_4220/loc_4221/loc_4225/loc_4226.
 */
export function summarizeFormationOccupancy(m) {
  const { mem8, mem16 } = m;

  // Per-row ORs behind their guard cells. Zero the two leading guard cells first (they are always empty so
  // consumers can index them without a bounds check), then OR each row's 10 columns into its summary cell.
  for (let i = 0; i < ROW_GUARD; i++) mem8[ROW_OCCUPANCY + i] = 0;
  for (let r = 0; r < ROWS; r++) {
    let acc = 0;
    for (let c = 0; c < COLS; c++) acc |= mem8[gridCell(r, c)];
    mem8[ROW_OCCUPANCY + ROW_GUARD + r] = acc;
  }

  // Per-column ORs behind their guard cells. Same shape as the rows but transposed: zero the three leading
  // column guards, then OR each column's 6 rows into its summary cell (addressed via columnOr).
  for (let i = 0; i < COL_GUARD; i++) mem8[COLUMN_OCCUPANCY + i] = 0;
  for (let c = 0; c < COLS; c++) {
    let acc = 0;
    for (let r = 0; r < ROWS; r++) acc |= mem8[gridCell(r, c)];
    mem8[columnOr(c)] = acc;
  }

  // Bound from the right end: scan inward from the rightmost column, one step per empty column. Start at
  // FROM_RIGHT_BASE (34) and add COLUMN_PITCH (16) of X for every empty column crossed until an occupied
  // column (bit0 set) is hit. This becomes the low byte of FORMATION_X_BOUNDS.
  let fromRight = FROM_RIGHT_BASE, found = false;
  for (let c = COLS - 1; c >= 0; c--) {
    if (mem8[columnOr(c)] & 1) { found = true; break; }
    fromRight += COLUMN_PITCH;
  }
  // If no column was occupied at all, the accumulated steps are meaningless -> reset to the base value.
  if (!found) fromRight = FROM_RIGHT_BASE;

  // Bound from the left end: mirror of the above -- scan inward from the leftmost column, stepping the X
  // DOWN from FROM_LEFT_BASE (224) per empty column. This becomes the high byte of FORMATION_X_BOUNDS.
  let fromLeft = FROM_LEFT_BASE; found = false;
  for (let c = 0; c < COLS; c++) {
    if (mem8[columnOr(c)] & 1) { found = true; break; }
    fromLeft -= COLUMN_PITCH;
  }
  // Same reset if the whole row of columns was empty.
  if (!found) fromLeft = FROM_LEFT_BASE;
  // Pack the two bounds into one 16-bit cell; the sweep oscillator reads them as the block's X limits.
  mem16[FORMATION_X_BOUNDS] = (fromLeft << 8) | fromRight; // low byte = from-right, high = from-left

  // Row clear-flags: OR the top four row summaries into loc_4221 (as XOR 1, so bit0 = "top region empty"),
  // then continue OR-ing the bottom two rows and store the whole-grid result into loc_4220. Because the
  // flags are the OR complemented in bit0, a fully empty region reads as 1 (clear) to the gates downstream.
  let rows = 0;
  for (let r = 0; r < 4; r++) rows |= mem8[ROW_OCCUPANCY + ROW_GUARD + r];
  mem8[loc_4221] = rows ^ CLEAR_TOGGLE;
  for (let r = 4; r < ROWS; r++) rows |= mem8[ROW_OCCUPANCY + ROW_GUARD + r];
  mem8[loc_4220] = rows ^ CLEAR_TOGGLE;

  // Object-table clear-flags: fold a strided field of the object records (OBJ_STRIDE = 32 bytes per slot).
  // First OR seven slots of the OBJ_TABLE (0x42d0) field into loc_4226, then keep OR-ing an eight-slot
  // field based at loc_42b1 (0x42b1) into loc_4225 -- again each stored as OR XOR 1 (bit0 set = empty).
  let objs = 0;
  for (let i = 0; i < 7; i++) objs |= mem8[OBJ_TABLE + i * OBJ_STRIDE];
  mem8[loc_4226] = objs ^ CLEAR_TOGGLE;
  for (let i = 0; i < 8; i++) objs |= mem8[loc_42b1 + i * OBJ_STRIDE];
  mem8[loc_4225] = objs ^ CLEAR_TOGGLE;
}
