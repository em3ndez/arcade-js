// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectEdgeRivet — the 100m edge-rivet pickup. Board-gated to 100m and run every frame, it works
 * in two passes over the armed latch so a rivet is never collected on the frame the player stands on
 * it. On a screen-edge rivet column it arms the latch and stops; otherwise, if the latch was armed
 * last frame, it disarms, builds a 3-bit slot from his position bits, and — unless he is off the
 * field or that slot is already empty — clears the slot's present flag, decrements RIVETS_LEFT,
 * blanks the rivet's three tilemap cells, raises the collection flags, and (on his feet) runs the
 * pickup follow-up. RIVETS_LEFT reaching zero completes the board, but that test lives elsewhere.
 *
 * LIVE-OUT: memory-only — the slot's present flag, RIVETS_LEFT, EDGE_RIVET_ARMED, three tilemap
 * cells, the three collection flags, and whatever the follow-up writes.
 */

import { u16, page } from "../../../core/int.js";
import {
  EDGE_RIVET_ARMED,
  EFFECT_SELECT,
  EFFECT_STATE,
  ITEM_COLLECTED,
  MARIO_AIRBORNE,
  MARIO_X,
  MARIO_Y,
  RIVETS_LEFT,
  RIVET_COL_BASE_LEFT,
  RIVET_COL_BASE_RIGHT,
  RIVET_PRESENT,
  TILEMAP_BASE,
} from "./names.js";

import { boardBitGate } from "./boardBitGate.js";
import { armEdgeRivetPickup } from "./armEdgeRivetPickup.js";
import { loc_1d95 } from "./loc_1d95.js";

const BOARD_GATE_MASK = 0x08; // board-gate mask: bit3 => this runs only on 100m
const EDGE_X_LEFT = 0x4b;     // left-edge rivet column
const EDGE_X_RIGHT = 0xb3;    // right-edge rivet column
const OFF_FIELD = 0xd0;       // a row index at or past this is off the rivet field
const BLANK_TILE = 0x10;       // erase tile written to the three rivet cells

const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

export function collectEdgeRivet(m) {
  const { mem8 } = m;

  if (!boardBitGate(m, BOARD_GATE_MASK)) return; // gate closed (not 100m) — do nothing

  const x = mem8[MARIO_X];
  if (x === EDGE_X_LEFT || x === EDGE_X_RIGHT) {
    armEdgeRivetPickup(m);
    return;
  }

  if (mem8[EDGE_RIVET_ARMED] !== 1) return;
  mem8[EDGE_RIVET_ARMED] = 0x00; // disarm

  let a = (mem8[MARIO_Y] - 1) & 0xff;
  if (a >= OFF_FIELD) return;

  let slot = 0;
  a = rotl8(a); if (a & 1) slot |= 0x04;          // top bit of the row index
  a = rotl8(a);                                    // one rotation whose bit is not used
  a = rotl8(a); if (a & 1) slot |= 0x02;          // middle bit of the row index
  if ((a & 0x07) === 0x06) slot |= 0x02;          // the band seam also sets the middle bit
  a = rotl8(x); if (a & 1) slot |= 0x01;          // left/right half, from the X high bit

  const slotAddr = u16(RIVET_PRESENT + slot);
  if (mem8[slotAddr] === 0) return;
  mem8[slotAddr] = 0x00;                           // clear this rivet's present flag

  mem8[RIVETS_LEFT] = mem8[RIVETS_LEFT] - 1;

  const row = slot >> 1;
  const base = (slot & 1) ? RIVET_COL_BASE_RIGHT : RIVET_COL_BASE_LEFT;
  const vaddr = u16(TILEMAP_BASE + base + 5 * row);

  // low byte wraps inside the page rather than carrying
  const pg = page(vaddr);
  const lo = vaddr & 0xff;
  mem8[vaddr] = BLANK_TILE;
  mem8[pg | ((lo - 1) & 0xff)] = BLANK_TILE;
  mem8[pg | ((lo + 1) & 0xff)] = BLANK_TILE;

  mem8[EFFECT_STATE] = 0x01;
  mem8[EFFECT_SELECT] = 0x01;
  mem8[ITEM_COLLECTED] = 0x01;

  const airborne = mem8[MARIO_AIRBORNE];
  if (airborne === 0) {
    loc_1d95(m, airborne);
  }
}
