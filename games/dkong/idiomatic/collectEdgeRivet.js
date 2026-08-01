// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectEdgeRivet — the 100m edge-rivet pickup handler: arm at a rivet edge, then
 * on a later frame remove the rivet the player just stepped off.  ROM 0x1A33.
 *
 * Runs every in-game frame from loc_197a's update cascade, but is board-gated: its
 * first act is `rst 0x30` with mask 0x08 (bit3 = 100m), so on 25m/50m/75m the gate
 * closes and it does nothing. Only on 100m (BOARD == 4) does it do work, in two passes
 * over the EDGE_RIVET_ARMED latch:
 *
 *   - ARM. If the player stands ON a screen-edge column (MARIO_X == 0x4B or 0xB3),
 *     it tail-calls armEdgeRivetPickup (EDGE_RIVET_ARMED := 1) and stops. Nothing is
 *     collected on the edge frame itself.
 *   - COLLECT. Otherwise, if EDGE_RIVET_ARMED == 1 (the player was on an edge last
 *     frame and has now stepped off), it DISARMS the latch and removes the rivet at
 *     the player's row/side:
 *       · build a 3-bit slot index from position bits — bit2 = (MARIO_Y-1) bit7,
 *         bit1 = (MARIO_Y-1) bit5 (or the top-three-bits == 6 seam), bit0 = MARIO_X
 *         bit7 (left/right half);
 *       · if that RIVET_PRESENT[slot] is already gone, stop; else clear it and
 *         decrement RIVETS_LEFT;
 *       · blank the rivet's three tilemap cells (tile 0x10) at a per-slot VRAM
 *         address (column base 0x012B right / 0x02CB left, +5 per row, +0x7400);
 *       · raise the collection flags 0x6340 / 0x6342 / 0x6225;
 *       · if the player is grounded (MARIO_AIRBORNE == 0), call loc_1d95 (which here
 *         re-clears 0x6225 to A == 0 and, being 100m, queues the pickup sound).
 *     Two early-outs before the slot test leave the latch DISARMED but change nothing
 *     else: the player is off the rivet field (MARIO_Y-1 >= 0xD0), or the slot is empty.
 *
 * The "arm" half lives in the sibling armEdgeRivetPickup (ROM 0x1A4B); RIVETS_LEFT
 * reaching 0 is what the board-complete test (ROM 0x1E80) watches to clear 100m.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a33.test.js.
 * GATE:     crafted-entry — attract plays 25m only, where the rst 0x30 gate is CLOSED,
 *           so every real dispatch (~1478/run) is the board-gated NO-OP; that reachable
 *           path is captured live. The 100m arm + collect + off-field + empty-slot arms
 *           are unreachable in attract, so each is exercised on a real captured entry
 *           poked to BOARD == 4 (identically on both sides): an X-edge sweep for ARM, an
 *           (X,Y) position sweep with all rivets present for COLLECT (both airborne and
 *           grounded), and off-field / empty-slot crafts. Teeth catch a wrong gate mask,
 *           a wrong slot bit, and a missing disarm.
 * LIVE-OUT: memory-only — RIVET_PRESENT[slot], RIVETS_LEFT, EDGE_RIVET_ARMED, three VRAM
 *           tiles, 0x6340 / 0x6342 / 0x6225, and (grounded) loc_1d95's writes. No live
 *           registers/flags: the sole exit successor in the cascade (sub_2a85) reloads A
 *           with `ld a,(0x6215)` before use, so the oracle's residual A/B/HL/BC/F are
 *           dead ABI (the whole-machine/pixel gate backstops that). BOUNDARY: two
 *           already-idiomatic callees still read the Z80 A register (they were not lifted
 *           to honest params) — boardBitGate reads the 0x08 gate mask, loc_1d95 reads the
 *           byte it stores — so A is SET immediately before each, purely as their input.
 * NAMES:    MARIO_X, MARIO_Y, MARIO_AIRBORNE, EDGE_RIVET_ARMED, RIVET_PRESENT,
 *           RIVETS_LEFT from ram.js. Collection flags 0x6340 / 0x6342 / 0x6225 kept hex
 *           (ram.js examined and declined to name them); edge columns / gate mask / VRAM
 *           bases kept hex (raw coordinates + a bit mask).
 */

import {
  MARIO_X,
  MARIO_Y,
  MARIO_AIRBORNE,
  EDGE_RIVET_ARMED,
  RIVET_PRESENT,
  RIVETS_LEFT,
} from "./ram.js";

import { boardBitGate } from "./boardBitGate.js";           // ROM 0x0030 (rst 0x30) — board-apply gate
import { armEdgeRivetPickup } from "./armEdgeRivetPickup.js"; // ROM 0x1A4B — EDGE_RIVET_ARMED := 1
import { loc_1d95 } from "./loc_1d95.js";                    // ROM 0x1D95 — commit 0x6225, off-25m pickup sound

const BOARD_GATE_MASK = 0x08; // rst 0x30 mask: bit3 => this runs only on board 4 (100m)
const EDGE_X_LEFT = 0x4b;     // left-edge rivet column
const EDGE_X_RIGHT = 0xb3;    // right-edge rivet column
const OFF_FIELD = 0xd0;       // (MARIO_Y-1) >= this => off the rivet field
const COL_BASE_RIGHT = 0x012b; // VRAM column base when slot bit0 set (right half)
const COL_BASE_LEFT = 0x02cb;  // VRAM column base when slot bit0 clear (left half)
const VRAM = 0x7400;           // tilemap base added to the per-slot column offset
const BLANK_TILE = 0x10;       // erase tile written to the three rivet cells

// Collection flags raised on a pickup; ram.js examined all three and left them unnamed.
const COLLECT_FLAG_A = 0x6340;
const COLLECT_FLAG_B = 0x6342;
const COLLECT_FLAG_C = 0x6225;

// Z80 `rlca`: rotate the 8-bit value left one, bit7 -> bit0; the carry it tests is the
// rotated-in low bit, i.e. (result & 1).
const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

/**
 * @param {object} m  the machine (uses m.mem and, only as callee input, m.regs.a).
 */
export function collectEdgeRivet(m) {
  const { regs, mem } = m;

  // ld a,0x08 / rst 0x30 — board-apply gate. boardBitGate reads A as the mask, so set it.
  regs.a = BOARD_GATE_MASK;
  if (!boardBitGate(m)) return; // gate closed (not 100m) -> caller-skip: do nothing

  const x = mem.read8(MARIO_X);
  // cp 0x4B / jp z ; cp 0xB3 / jp z — on a rivet edge, ARM and stop (no collect this frame).
  if (x === EDGE_X_LEFT || x === EDGE_X_RIGHT) {
    armEdgeRivetPickup(m); // ROM 0x1A4B: EDGE_RIVET_ARMED := 1
    return;
  }

  // ld a,(0x6291) / dec a / jp nz — proceed only if the latch was armed (== 1) last frame.
  if (mem.read8(EDGE_RIVET_ARMED) !== 1) return;
  mem.write8(EDGE_RIVET_ARMED, 0x00); // disarm (A == 0 after the dec)

  // ld a,(0x6205) / dec a / cp 0xD0 / jr nc — off the rivet field: nothing more to do.
  let a = (mem.read8(MARIO_Y) - 1) & 0xff;
  if (a >= OFF_FIELD) return;

  // Build the 3-bit rivet slot from position bits (faithful to the rlca/set-b sequence).
  let slot = 0;
  a = rotl8(a); if (a & 1) slot |= 0x04;          // rlca ; set 2,b  -> bit2 = (Y-1) bit7
  a = rotl8(a);                                    // rlca (carry discarded)
  a = rotl8(a); if (a & 1) slot |= 0x02;          // rlca ; set 1,b  -> bit1 = (Y-1) bit5
  if ((a & 0x07) === 0x06) slot |= 0x02;          // and 7 ; cp 6 ; set 1,b (band seam)
  a = rotl8(x); if (a & 1) slot |= 0x01;          // ld a,(0x6203) ; rlca ; set 0,b -> bit0 = X bit7

  // ld hl,0x6292 / add a,l / ld l,a / ld a,(hl) / and a / jr z — empty slot: stop (still disarmed).
  const slotAddr = (RIVET_PRESENT + slot) & 0xffff;
  if (mem.read8(slotAddr) === 0) return;
  mem.write8(slotAddr, 0x00);                     // clear this rivet's present flag

  // ld hl,0x6290 / dec (hl) — one fewer rivet on the board.
  mem.write8(RIVETS_LEFT, (mem.read8(RIVETS_LEFT) - 1) & 0xff);

  // Per-slot VRAM address: column base by slot bit0, +5 per row (slot>>1), +0x7400.
  const row = slot >> 1;                                     // rra: A = B>>1, carry = B bit0
  const base = (slot & 1) ? COL_BASE_RIGHT : COL_BASE_LEFT;  // carry-set -> 0x012B, else 0x02CB
  const vaddr = (VRAM + base + 5 * row) & 0xffff;

  // Erase the 3 rivet cells [L], [L-1], [L+1] with 8-bit L wrap (inc/dec l, not hl).
  const page = vaddr & 0xff00;
  const lo = vaddr & 0xff;
  mem.write8(vaddr, BLANK_TILE);
  mem.write8(page | ((lo - 1) & 0xff), BLANK_TILE);
  mem.write8(page | ((lo + 1) & 0xff), BLANK_TILE);

  // ld a,1 -> 0x6340 / 0x6342 / 0x6225 — raise the collection flags.
  mem.write8(COLLECT_FLAG_A, 0x01);
  mem.write8(COLLECT_FLAG_B, 0x01);
  mem.write8(COLLECT_FLAG_C, 0x01);

  // ld a,(0x6216) / and a / call z,0x1d95 — grounded: run the pickup follow-up. loc_1d95
  // reads A (the byte it stores into 0x6225), so pass A == the 0x6216 value (0 here).
  const airborne = mem.read8(MARIO_AIRBORNE);
  if (airborne === 0) {
    regs.a = airborne; // == 0; boundary: loc_1d95 stores A -> 0x6225 (re-clears it)
    loc_1d95(m);       // ROM 0x1D95
  }
}
