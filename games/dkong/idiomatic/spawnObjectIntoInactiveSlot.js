// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnObjectIntoInactiveSlot — inactive object slot: consume a pending spawn request and bring
 * the slot to life, otherwise just step the scan on.  ROM 0x2EA7.
 *
 * The inactive-object arm of the per-object update loop (entry_2e04), dispatched by
 * obj_2e12 when a slot's active flag is clear. It tests the one-shot spawn request
 * (SPAWN_REQUEST bit0): if no spawn is pending the slot stays inactive and the scan
 * simply advances. If a spawn IS pending it consumes the request — clearing it so no
 * other inactive slot also spawns this pass — and seeds the slot: a fixed initial Y, an
 * initial X drawn from the freshly stirred random seed, its animation-string pointer
 * aimed at the string base, and its state and active flags set. Either way it ends by
 * advancing both scan cursors to the next object (the oracle tail-jumps into that shared
 * advance).
 *
 * The random seed is produced by stirRandomSeed, which leaves the fresh seed value for
 * this routine to read (its documented register hand-off).
 *
 * The object record is addressed by the object-scan cursor, carried in registers by the
 * still-translated scan loop (a genuine oracle boundary); the paired sprite cursor is
 * passed straight through, untouched, to the advance tail.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): ram.js SPAWN_REQUEST (0x6396) cites it
 * explicitly — "loc_2ea7 tests bit0 -> activates the object (+0:=1, position/appearance seeded) and
 * clears it to 0"; it sets named OBJ_ACTIVE / X / Y / STATE. The name claims only the spawn ACTION;
 * which object this spawns and its game role stay ungrounded (sibling state handlers loc_2e84 /
 * loc_2e9c remain loc_).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ea7.test.js.
 * GATE:     crafted + captured. The spawn-request byte is swept over all 256 values (pins
 *           that only bit0 selects the spawn vs advance arm); with a spawn pending, the
 *           stirred seed is swept over all 256 values across several frame/spin combos
 *           (pins the initial-X nibble + bias and the seed write, covering the 8-bit sum
 *           wrap); the exact in-game object-slot sequence is cross-producted (pins the
 *           record-relative writes across all ten slots); an independence sweep varies the
 *           ignored registers and RAM; and real captured 0x2ea7 dispatches from a steered
 *           full entry_2e04 loop (ten inactive slots, one spawn pending) replay oracle vs
 *           candidate over both arms. Attract never reaches the loop. The oracle brackets
 *           its stirRandomSeed call with a push/ret, so its dead STACK_SCRATCH churn is
 *           excluded from the RAM diff. Teeth: wrong spawn Y, dropped request-clear, wrong
 *           X bias, missing activate, inverted arm, dropped nibble mask.
 * LIVE-OUT: memory — SPAWN_REQUEST cleared, the object record's Y / X / state / active /
 *           animation-pointer fields, and the stirred RANDOM seed; plus the registers the
 *           advance tail leaves — object cursor +16, sprite cursor +4, remaining-object
 *           count preserved, step value 4. The seed the oracle leaves in the accumulator
 *           and its residual pointer register are dead: the loop reloads them for the next
 *           object before any test, and no exit successor reads them (nor the landing pc).
 * NAMES:    SPAWN_REQUEST (0x6396), OBJ_ACTIVE (+0), OBJ_X (+3), OBJ_Y (+5), OBJ_STATE
 *           (+0x0d) — from ram.js, the object-record fields indexed off the scan cursor.
 *           The animation-string pointer field (+0x0e/+0x0f) has no ram.js name and stays a
 *           local const; its value, the animation-string base 0x39AA, is a ROM address (not
 *           work RAM), so it stays hex.
 */

import { SPAWN_REQUEST, OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_STATE } from "./ram.js";
import { stirRandomSeed } from "./stirRandomSeed.js";           // ROM 0x0057
import { advanceToNextObject } from "./advanceToNextObject.js"; // ROM 0x2E78

// Object-record animation-string pointer field (+0x0e low, +0x0f high). No ram.js name yet.
const OBJ_ANIM_PTR = 0x0e;
// ROM base of the object's animation string (a ROM address, so hex).
const ANIMATION_STRING_BASE = 0x39aa;
// Fixed initial Y the spawned object starts at.
const SPAWN_Y = 80;

/**
 * @param {object} m  the machine. The object-scan cursor arrives in a register; the paired
 *                    sprite cursor is passed through to the advance tail unchanged.
 * @returns {void}
 */
export function spawnObjectIntoInactiveSlot(m) {
  const { regs, mem } = m;

  // No spawn pending for this slot -> leave it inactive and step the scan on.
  if ((mem.read8(SPAWN_REQUEST) & 0x01) === 0) {
    advanceToNextObject(m);
    return;
  }

  // Consume the one-shot request so no other inactive slot also spawns this pass.
  mem.write8(SPAWN_REQUEST, 0);

  // Seed the slot's fixed fields.
  mem.write8(regs.ix + OBJ_Y, SPAWN_Y);
  mem.write8(regs.ix + OBJ_STATE, 1);

  // Initial X: the stirred seed's low nibble biased down by 8, so the spawn column spreads
  // over the 16-wide window 0xF8..0x07 as a byte. stirRandomSeed leaves the fresh seed here.
  stirRandomSeed(m);
  const seed = regs.a;
  mem.write8(regs.ix + OBJ_X, (seed & 0x0f) - 8);

  // Bring the slot to life and aim its animation-string pointer at the string base.
  mem.write8(regs.ix + OBJ_ACTIVE, 1);
  mem.write8(regs.ix + OBJ_ANIM_PTR, ANIMATION_STRING_BASE & 0xff);
  mem.write8(regs.ix + OBJ_ANIM_PTR + 1, (ANIMATION_STRING_BASE >> 8) & 0xff);

  // Advance both scan cursors to the next object (the oracle tail-jumps here).
  advanceToNextObject(m);
}
