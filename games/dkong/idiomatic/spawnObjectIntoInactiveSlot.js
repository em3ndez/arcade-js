// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnObjectIntoInactiveSlot — inactive object slot: consume a pending spawn request and bring the
 * slot to life, otherwise just step the scan on.
 *
 * The inactive-object arm of the per-object update loop, reached when a slot's active flag is
 * clear. It tests the one-shot spawn request (SPAWN_REQUEST bit 0). If no spawn is pending the slot
 * stays inactive and the scan simply advances. If a spawn IS pending it consumes the request —
 * clearing it so no other inactive slot also spawns this pass — and seeds the slot: a fixed initial
 * Y, an initial X drawn from the freshly stirred random seed, its animation-string pointer aimed at
 * the string base, and its state and active flags set. Either way it ends by advancing both scan
 * cursors to the next object.
 *
 * The random seed comes from the stirrer, which leaves the fresh value in the accumulator for this
 * routine to read — its register hand-off.
 *
 * The object record is addressed by the object-scan cursor, which the scan loop carries in
 * registers; the paired sprite cursor is passed straight through, untouched, to the advance tail.
 *
 * WHAT THE NAME DOES NOT CLAIM: which object this spawns, or what it does in the game. The name
 * covers the spawn ACTION only.
 *
 * LIVE-OUT: memory — SPAWN_REQUEST cleared, the object record's Y / X / state / active /
 * animation-pointer fields, and the stirred random seed; plus the registers the advance tail leaves
 * behind — object cursor advanced by 16, sprite cursor by 4, remaining-object count preserved, step
 * value 4. The seed left in the accumulator and the residual pointer register are dead: the loop
 * reloads them for the next object before any test.
 */

import { SPAWN_REQUEST, OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";
import { stirRandomSeed } from "./stirRandomSeed.js";
import { advanceToNextObject } from "./advanceToNextObject.js";

// The object record's animation-string pointer field (low byte, then high). It carries no shared
// name, so the offset stays file-local.
const OBJ_ANIM_PTR = 0x0e;
// Base of the object's animation string. It is a code-space address, not work RAM, so it stays a
// bare constant.
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

  // Initial X: the stirred seed's low nibble biased down by 8, so the spawn column spreads over a
  // 16-wide window that straddles zero as a byte. The stirrer leaves the fresh seed here.
  stirRandomSeed(m);
  const seed = regs.a;
  mem.write8(regs.ix + OBJ_X, (seed & 0x0f) - 8);

  // Bring the slot to life and aim its animation-string pointer at the string base.
  mem.write8(regs.ix + OBJ_ACTIVE, 1);
  mem.write8(regs.ix + OBJ_ANIM_PTR, ANIMATION_STRING_BASE & 0xff);
  mem.write8(regs.ix + OBJ_ANIM_PTR + 1, (ANIMATION_STRING_BASE >> 8) & 0xff);

  // Advance both scan cursors to the next object.
  advanceToNextObject(m);
}
