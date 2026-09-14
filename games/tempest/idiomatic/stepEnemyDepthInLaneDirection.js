// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  ENEMY_CLIMB_DELTA_LO_0, ENEMY_CLIMB_DELTA_HI_0, PLAYER_SHOT_DEPTH, ENEMY_SLOT_FLAGS, ENEMY_SLOT_DIR, ENEMY_DEPTH_LO, ENEMY_DEPTH,
} from "./names.js";
import { settleEnemyAtTargetDepth } from "./settleEnemyAtTargetDepth.js";
import { retireEnemyAndSpawnSplit } from "./retireEnemyAndSpawnSplit.js";

/**
 * stepEnemyDepthInLaneDirection — step slot x's depth along its lane, in its travel direction. ROM 0x9c58.
 *
 * Role in the machine: every enemy has a 16-bit "depth" — how far down the tube it is, from the far rim
 * toward the player's rim. This routine moves one enemy one tick of depth, in whichever direction the
 * slot is travelling, using a per-segment speed so lanes of different length advance at matched rates.
 * It is the fan-out point: it picks the speed and hands off to the add or subtract path.
 *
 * Behavior: read the slot's segment from ENEMY_SLOT_FLAGS,x & 7 (this indexes the ENEMY_CLIMB_DELTA_LO_0
 * / ENEMY_CLIMB_DELTA_HI_0 speed table). Branch on the sign of ENEMY_SLOT_DIR,x: bit7 set -> subtract
 * path (reverseEnemyLaneDepth, moving away/up), bit7 clear -> add path (advanceEnemyLaneDepth, moving
 * toward the player). The segment index is passed explicitly so each path reads the delta at that index.
 *
 * Live-out: delegated to the chosen path — the updated ENEMY_DEPTH_LO,x / ENEMY_DEPTH,x and its
 * register return. Grounding: [seen].
 */
export function stepEnemyDepthInLaneDirection(m, x = m.regs.x) {
  const { mem8 } = m;
  const seg = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x07;
  if (mem8[u16(ENEMY_SLOT_DIR + x)] & 0x80) return reverseEnemyLaneDepth(m, x, seg);
  return advanceEnemyLaneDepth(m, x, seg);
}

// ADD path: coordinate += delta (16-bit, with carry). Then on the new hi byte: reaching PLAYER_SHOT_DEPTH (or
// below) steps the slot via the equal/over handler; otherwise a hi that stays under 0x20 with an armed
// (ENEMY_SLOT_DIR,x & 3) gate retires/replaces the slot (called with the slot as both index args, so X and A
// come back as the slot index).
// Returns [A live-out, Y live-out]; the caller's seed tail reads the Y (y is the delta index).
export function advanceEnemyLaneDepth(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const loSum = mem8[u16(ENEMY_DEPTH_LO + x)] + mem8[u16(ENEMY_CLIMB_DELTA_LO_0 + y)]; // clc: carry-in 0
  mem8[u16(ENEMY_DEPTH_LO + x)] = loSum;
  const carry = loSum > 0xff ? 1 : 0;
  const hi = u8(mem8[u16(ENEMY_DEPTH + x)] + mem8[u16(ENEMY_CLIMB_DELTA_HI_0 + y)] + carry);
  mem8[u16(ENEMY_DEPTH + x)] = hi;

  // at/below the floor: step the slot; Y comes from the step (or stays the delta index)
  if (hi <= mem8[PLAYER_SHOT_DEPTH]) return [undefined, settleEnemyAtTargetDepth(m, x) ?? y];
  if (hi >= 0x20) return [(m.regs.a = hi), y];              // above 0x20 -> A = new hi, Y = the index
  if ((mem8[u16(ENEMY_SLOT_DIR + x)] & 0x03) === 0) return [(m.regs.a = 0x00), y]; // gate clear -> A = 0
  retireEnemyAndSpawnSplit(m, x, x); // retire helper: slot passed as both index args (X and Y)
  return [(m.regs.a = x), x]; // retire done -> A and the Y live-out come back as the slot index
}

// SUB path: coordinate -= delta (16-bit, with borrow). If the new hi underflows past 0xf0 (>= 0xf0
// after the subtract, the bcc NOT taken) floor it to 0xf2. A live-out is the new hi, or 0xf2 on the floor.
export function reverseEnemyLaneDepth(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const loDiff = mem8[u16(ENEMY_DEPTH_LO + x)] - mem8[u16(ENEMY_CLIMB_DELTA_LO_0 + y)]; // sec: borrow-in 0
  mem8[u16(ENEMY_DEPTH_LO + x)] = loDiff;
  const borrow = loDiff < 0 ? 1 : 0;
  const hi = u8(mem8[u16(ENEMY_DEPTH + x)] - mem8[u16(ENEMY_CLIMB_DELTA_HI_0 + y)] - borrow);
  mem8[u16(ENEMY_DEPTH + x)] = hi;

  if (hi < 0xf0) return (m.regs.a = hi); // bcc taken -> no floor
  mem8[u16(ENEMY_DEPTH + x)] = 0xf2;
  return (m.regs.a = 0xf2);
}
