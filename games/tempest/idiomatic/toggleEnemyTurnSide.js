// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS } from "./names.js";

/**
 * toggleEnemyTurnSide — flip an enemy slot's turn/rotation-side flag in place. ROM 0x9c4f.
 *
 * Role in the machine: every active enemy on the tube (flippers, tankers, spikers) carries a per-slot
 * flags byte at loc_283,x. Bit 6 of that byte is the "turn side" — which way the creature rotates as it
 * walks the rim from lane to lane. This is the atomic primitive the lane-hop logic uses to reverse a
 * creature's spin: callers such as flipEnemyLaneTowardTarget re-derive the desired side, then invoke this
 * to commit the flip.
 *
 * Behavior: index slot x's flags cell loc_283+x, XOR it with 0x40 to invert bit 6 alone (every other
 * flag bit is preserved), store the result back to the same cell, and also leave the new byte in A so a
 * caller can branch on the freshly-set side without a re-read.
 *
 * Live-out: loc_283,x (bit 6 toggled, all other bits intact) and the A register (= the new flags value).
 * Grounding: [seen].
 */
export function toggleEnemyTurnSide(m, x = m.regs.x) {
  const { mem8 } = m;
  // loc_283,x — slot x's direction/flags byte on the tube rim.
  const addr = u16(ENEMY_SLOT_FLAGS + x);
  // XOR 0x40 inverts bit 6 (turn side) only; the other seven flag bits are untouched.
  const value = mem8[addr] ^ 0x40;
  mem8[addr] = value;
  // Return the updated byte in A so the caller can test the new side without reloading.
  return (m.regs.a = value);
}
