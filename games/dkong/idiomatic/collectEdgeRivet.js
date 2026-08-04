// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectEdgeRivet — the 100m edge-rivet pickup: arm at a rivet edge, then on a later frame remove
 * the rivet the player has just stepped off.
 *
 * Runs every in-game frame, but is board-gated: its first act consults the board gate with the
 * 100m bit, so on the other three boards it does nothing at all. On 100m it works in two passes
 * over the EDGE_RIVET_ARMED latch, and a rivet is NEVER collected on the frame the player is
 * standing on it:
 *
 *   - ARM. If the player is standing on one of the two screen-edge rivet columns, raise the latch
 *     and stop.
 *   - COLLECT. Otherwise, if the latch is up — he was on an edge last frame and has now stepped
 *     off — DISARM it and remove the rivet at his row and side:
 *       · build a 3-bit slot index out of position bits: two bits from his Y pick the row band
 *         (with an extra seam case folded into the middle bit), and his X high bit picks the
 *         left or right half;
 *       · if that slot's rivet is already gone, stop; otherwise clear the slot's present flag and
 *         count one off RIVETS_LEFT;
 *       · blank the rivet's three tilemap cells with the blank tile, at a per-slot address
 *         derived from the column base for that half plus a fixed step per row;
 *       · raise the collection flags EFFECT_STATE, EFFECT_SELECT and ITEM_COLLECTED;
 *       · if the player is on his feet rather than airborne, run the pickup follow-up, which
 *         clears the collected flag again and queues the pickup sound.
 *     Two early-outs before the slot test leave the latch DISARMED and change nothing else: the
 *     player is off the rivet field entirely, or the slot he is at is already empty.
 *
 * RIVETS_LEFT reaching zero is what completes the board, but that test is made elsewhere; all this
 * routine does is count them off one at a time.
 *
 * LIVE-OUT: memory-only — the slot's present flag, RIVETS_LEFT, EDGE_RIVET_ARMED, three tilemap
 * cells, the three collection flags, and whatever the follow-up writes.
 */

import {
  MARIO_X,
  MARIO_Y,
  MARIO_AIRBORNE,
  EDGE_RIVET_ARMED,
  RIVET_PRESENT,
  RIVETS_LEFT,
  EFFECT_STATE,
  EFFECT_SELECT,
  ITEM_COLLECTED,
} from "./names.js";

import { boardBitGate } from "./boardBitGate.js";
import { armEdgeRivetPickup } from "./armEdgeRivetPickup.js";
import { loc_1d95 } from "./loc_1d95.js";

const BOARD_GATE_MASK = 0x08; // board-gate mask: bit3 => this runs only on 100m
const EDGE_X_LEFT = 0x4b;     // left-edge rivet column
const EDGE_X_RIGHT = 0xb3;    // right-edge rivet column
const OFF_FIELD = 0xd0;       // a row index at or past this is off the rivet field
const COL_BASE_RIGHT = 0x012b; // tilemap column base when the slot's low bit is set (right half)
const COL_BASE_LEFT = 0x02cb;  // tilemap column base when it is clear (left half)
const VRAM = 0x7400;           // tilemap base added to the per-slot column offset
const BLANK_TILE = 0x10;       // erase tile written to the three rivet cells

// Rotate the 8-bit value left by one, top bit into the bottom; the bit being tested afterwards is
// that rotated-in low bit.
const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

/**
 * @param {object} m  the machine (writes work RAM and the tilemap).
 */
export function collectEdgeRivet(m) {
  const { regs, mem } = m;

  // Board gate: it reads the mask from the accumulator, so set it first.
  regs.a = BOARD_GATE_MASK;
  if (!boardBitGate(m)) return; // gate closed (not 100m) — do nothing

  const x = mem.read8(MARIO_X);
  // Standing on a rivet edge: ARM and stop. Nothing is collected on the edge frame itself.
  if (x === EDGE_X_LEFT || x === EDGE_X_RIGHT) {
    armEdgeRivetPickup(m);
    return;
  }

  // Proceed only if the latch was armed last frame.
  if (mem.read8(EDGE_RIVET_ARMED) !== 1) return;
  mem.write8(EDGE_RIVET_ARMED, 0x00); // disarm

  // Off the rivet field: nothing more to do.
  let a = (mem.read8(MARIO_Y) - 1) & 0xff;
  if (a >= OFF_FIELD) return;

  // Build the 3-bit rivet slot out of position bits.
  let slot = 0;
  a = rotl8(a); if (a & 1) slot |= 0x04;          // top bit of the row index
  a = rotl8(a);                                    // one rotation whose bit is not used
  a = rotl8(a); if (a & 1) slot |= 0x02;          // middle bit of the row index
  if ((a & 0x07) === 0x06) slot |= 0x02;          // the band seam also sets the middle bit
  a = rotl8(x); if (a & 1) slot |= 0x01;          // left/right half, from the X high bit

  // Empty slot: stop here, still disarmed.
  const slotAddr = (RIVET_PRESENT + slot) & 0xffff;
  if (mem.read8(slotAddr) === 0) return;
  mem.write8(slotAddr, 0x00);                     // clear this rivet's present flag

  // One fewer rivet on the board.
  mem.write8(RIVETS_LEFT, (mem.read8(RIVETS_LEFT) - 1) & 0xff);

  // Per-slot tilemap address: the column base for this half, plus five cells per row.
  const row = slot >> 1;
  const base = (slot & 1) ? COL_BASE_RIGHT : COL_BASE_LEFT;
  const vaddr = (VRAM + base + 5 * row) & 0xffff;

  // Erase the three rivet cells — the one at that address and its two neighbours — with the low
  // byte of the address wrapping inside its page rather than carrying.
  const page = vaddr & 0xff00;
  const lo = vaddr & 0xff;
  mem.write8(vaddr, BLANK_TILE);
  mem.write8(page | ((lo - 1) & 0xff), BLANK_TILE);
  mem.write8(page | ((lo + 1) & 0xff), BLANK_TILE);

  // Raise the collection flags.
  mem.write8(EFFECT_STATE, 0x01);
  mem.write8(EFFECT_SELECT, 0x01);
  mem.write8(ITEM_COLLECTED, 0x01);

  // On his feet rather than airborne: run the pickup follow-up. It stores the accumulator into
  // the collected flag, so the zero that got us here is what re-clears it.
  const airborne = mem.read8(MARIO_AIRBORNE);
  if (airborne === 0) {
    regs.a = airborne;
    loc_1d95(m);
  }
}
