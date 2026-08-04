// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e12 — per-object update entry: dispatch one object by its active flag and state,
 * otherwise walk it one animation-string step.  ROM 0x2E12.
 *
 * The body of the per-object scan loop (entry_2e04): called once per object, with the object
 * record addressed by the object-scan cursor and its paired sprite record by the sprite-scan
 * cursor. It routes the object four ways:
 *   • Inactive (active-flag bit0 clear) -> the spawn/advance arm (spawnObjectIntoInactiveSlot).
 *   • Active: first, every 16 frames, flip the low 3 bits of the sprite's tile code (an
 *     animation flicker on the paired sprite record).
 *   • State 4 -> the step / deactivate handler (loc_2e84).
 *   • Otherwise (default active motion) -> advance X by 2 and read the next animation-string
 *     byte through the object's walk pointer: on the terminator (0x7f) rewind the walk in
 *     loc_2e9c; on a normal byte advance the pointer and accumulate the byte into the object's
 *     Y. Both non-state-4 arms converge at loc_2e4b (which stores the pointer and runs the
 *     end-of-walk boundary test), and every arm ends in the shared cursor advance.
 *
 * NAME: kept as loc_2e12, matching the sibling state handlers loc_2e84 / loc_2e9c / loc_2e4b.
 * The mechanism is clear (a four-way active/state dispatcher with an inline default-motion
 * arm), but which object this drives and what the animation-string-driven motion represents
 * are not grounded here, so the effect-level name is left for a clarify/grounding pass rather
 * than guessed.
 *
 * The object and sprite cursors, and (into the shared tails) the walk pointer and last-read
 * string byte, are carried in registers by the still-translated scan loop — a genuine oracle
 * boundary — so this routine hands the tails exactly what they read: the last string byte in
 * the byte register and, on the normal-byte path, the advanced pointer in the pointer
 * register, before the direct loc_2e9c / loc_2e4b calls.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e12.test.js.
 * GATE:     crafted + captured. At a real object/sprite record pair the active flag is swept
 *           over all 256 values (only bit0 selects the inactive arm), the state byte over all
 *           256 (only 4 selects loc_2e84), and the animation-string byte over all 256 through a
 *           controlled walk pointer (only 0x7f selects the terminator rewind; the rest pin the
 *           X+=2 and Y+=byte motion), the last swept at both a below- and an above-boundary X
 *           so loc_2e4b's transition arm fires; the sprite-code toggle is swept over all 256
 *           code values at both frame phases (fires on FRAME&0x0f==0); the exact in-game cursor
 *           sequence is grid-cross-producted; an independence sweep varies the ignored registers
 *           and RAM; and real captured 0x2e12 dispatches from a steered full entry_2e04 loop
 *           replay oracle vs candidate across all four arms. Attract never reaches the loop. The
 *           inactive arm's spawn tail brackets its stirRandomSeed call with a push/ret, so its
 *           dead STACK_SCRATCH churn is excluded from the RAM diff; the other three arms perform
 *           no push/pop (SP unchanged everywhere).
 * LIVE-OUT: memory — the per-arm object / sprite / state / sound / pointer writes the arms and
 *           their shared tails make — plus the registers the shared advance tail leaves: object
 *           cursor +16, sprite cursor +4, remaining-object count preserved, step value 4. The
 *           scratch byte the oracle leaves in the accumulator, its residual pointer register on
 *           the state-4 / inactive arms, and its landing pc are dead: the loop reloads/re-derives
 *           them for the next object before any test.
 * NAMES:    FRAME (0x601A), OBJ_ACTIVE (+0), OBJ_STATE (+0x0d), OBJ_X (+3), OBJ_Y (+5),
 *           SPRITE_CODE (sprite record +1) — from names.js. The animation-string walk pointer
 *           (+0x0e/+0x0f) has no names.js name and stays a local const.
 */

import { FRAME, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y, SPRITE_CODE } from "./names.js";
import { spawnObjectIntoInactiveSlot } from "./spawnObjectIntoInactiveSlot.js"; // ROM 0x2EA7
import { loc_2e84 } from "./loc_2e84.js"; // ROM 0x2E84
import { loc_2e9c } from "./loc_2e9c.js"; // ROM 0x2E9C
import { loc_2e4b } from "./loc_2e4b.js"; // ROM 0x2E4B

// Object-record animation-string walk pointer (low at +0x0e, high at +0x0f). No names.js name.
const OBJ_STR_PTR = 0x0e;

const FRAME_TOGGLE_MASK = 0x0f;    // toggle fires once every 16 frames (FRAME low nibble == 0)
const ANIM_TOGGLE_BITS = 0x07;     // low 3 bits of the sprite tile code flipped by the toggle
const STEP_STATE = 4;              // OBJ_STATE handled by loc_2e84 (the step / deactivate state)
const STRING_TERMINATOR = 0x7f;    // animation-string end sentinel

/**
 * @param {object} m  the machine. The object-scan cursor and paired sprite-scan cursor arrive
 *                    in registers; the string byte / advanced pointer are handed to the tails
 *                    through registers.
 * @returns {void}
 */
export function loc_2e12(m) {
  const { regs, mem } = m;
  const ix = regs.ix; // object-record scan cursor
  const iy = regs.iy; // paired sprite-record scan cursor

  // Inactive slot (active-flag bit0 clear): hand off to the spawn/advance arm.
  if ((mem.read8(ix + OBJ_ACTIVE) & 0x01) === 0) {
    spawnObjectIntoInactiveSlot(m);
    return;
  }

  // Every 16 frames, flip the low 3 bits of the paired sprite's tile code (animation flicker).
  if ((mem.read8(FRAME) & FRAME_TOGGLE_MASK) === 0) {
    mem.write8(iy + SPRITE_CODE, mem.read8(iy + SPRITE_CODE) ^ ANIM_TOGGLE_BITS);
  }

  // State 4 objects step and deactivate in loc_2e84.
  if (mem.read8(ix + OBJ_STATE) === STEP_STATE) {
    loc_2e84(m);
    return;
  }

  // Default active motion: advance the object's X by 2.
  mem.write8(ix + OBJ_X, mem.read8(ix + OBJ_X) + 2);

  // Read the next animation-string byte through the object's walk pointer. The shared tails
  // read the last string byte from the byte register (genuine oracle boundary), so hand it over.
  const ptr = mem.read8(ix + OBJ_STR_PTR) | (mem.read8(ix + OBJ_STR_PTR + 1) << 8);
  const strByte = mem.read8(ptr);
  regs.c = strByte;

  // Terminator: rewind the walk in loc_2e9c (which falls into loc_2e4b).
  if (strByte === STRING_TERMINATOR) {
    loc_2e9c(m);
    return;
  }

  // Normal byte: advance the walk pointer (handed to loc_2e4b through the pointer register) and
  // accumulate the byte into the object's Y, then converge at loc_2e4b (store the pointer, run
  // the end-of-walk boundary test, mirror the position to the sprite).
  regs.hl = (ptr + 1) & 0xffff;
  mem.write8(ix + OBJ_Y, strByte + mem.read8(ix + OBJ_Y));
  loc_2e4b(m);
}
