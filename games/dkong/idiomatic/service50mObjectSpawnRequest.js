// SPDX-License-Identifier: GPL-3.0-only
/**
 * service50mObjectSpawnRequest — service the 50m moving-object spawn request, paced by a cooldown
 * timer.
 *
 * Reached only on 50m, and run each pass while a spawn may be pending. It first gates on a cooldown
 * timer (OBJ_SPAWN_TIMER): while the timer is still running it simply ticks it down and returns.
 * Once the timer has drained it looks at the spawn request (OBJ_SPAWN_REQ, a whole-byte "nonzero =
 * requested" test): with no request it returns untouched; with a request it scans the six records
 * of OBJ_ARRAY_65A0 for a free slot — one whose active-flag bit 0 is clear. If every slot is busy
 * it gives up. Otherwise it brings the first free slot to life:
 *
 *   - Rolls the pseudo-random seed and, from that roll plus two of the 50m step-direction latches,
 *     chooses the spawned record's Y field (0x7C default, or 0xCC) and its X field (0x07 default,
 *     or 0xF8):
 *       * a roll below 0x60                                  -> the 0xCC-Y arm;
 *       * a roll at or above 0x60 with the second object's
 *         step direction == 1                                -> the same 0xCC-Y arm;
 *         on that arm the X override follows the top bit of the THIRD object's step-direction
 *         latch;
 *       * a roll at or above 0x60 with that step direction != 1 -> a SECOND roll, whose
 *         "below 0x68" decides the X override, keeping the default Y.
 *   - Stamps the record's activate flag, sprite code and hit extents, reloads the cooldown timer,
 *     and clears the request.
 *
 * SHARED DECREMENT TAIL: the timer-running path and the spawn path converge on a single decrement,
 * and the pointer it uses differs by path — on the timer path it still points at OBJ_SPAWN_TIMER,
 * but on the spawn path it is the pointer the seed stirrer leaves behind, which is SPIN_COUNT.
 * Nothing on the spawn path moves that pointer before the decrement, so the freshly-reloaded timer
 * survives at 0x7C and SPIN_COUNT is what ticks down by one. Reproduced here as two explicit
 * decrements of the two known cells. The two no-op returns — no request, or no free slot —
 * decrement nothing.
 *
 * The seed stirrer hands its fresh value back in the accumulator, so this routine reads the
 * accumulator immediately after each call, exactly where the value is consumed.
 *
 * LIVE-OUT: memory only. The caller resumes its own work without reading a register or flag left
 * behind here.
 */

import {
  OBJ_SPAWN_TIMER,
  OBJ_SPAWN_REQ,
  OBJ_ARRAY_65A0,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  M50_OBJ2_STEP_DIR,
  M50_OBJ3_STEP_DIR,
  SPIN_COUNT,
  OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y,} from "./names.js";
import { stirRandomSeed } from "./stirRandomSeed.js";

const SLOT_STRIDE = 0x10; // the record stride of the object array scanned here
const SLOT_COUNT = 6;     // records scanned for a free slot

export function service50mObjectSpawnRequest(m) {
  const { regs, mem } = m;

  // Cooldown still running: tick it down and stop.
  if (mem.read8(OBJ_SPAWN_TIMER) !== 0) {
    mem.write8(OBJ_SPAWN_TIMER, (mem.read8(OBJ_SPAWN_TIMER) - 1) & 0xff);
    return;
  }

  // Cooldown drained: only act on a pending request (whole-byte nonzero).
  if (mem.read8(OBJ_SPAWN_REQ) === 0) return; // nothing requested — no decrement

  // Find the first free slot (active-flag bit0 clear) among the six records.
  let slot = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const base = (OBJ_ARRAY_65A0 + i * SLOT_STRIDE) & 0xffff;
    if ((mem.read8((base + OBJ_ACTIVE) & 0xffff) & 0x01) === 0) {
      slot = base;
      break;
    }
  }
  if (slot === -1) return; // every slot busy — nothing spawned, no decrement

  // Roll the seed and default the Y field.
  stirRandomSeed(m);
  const roll = regs.a;
  mem.write8((slot + OBJ_Y) & 0xffff, 0x7c);

  let overrideY = roll < 0x60;
  let overrideX; // true -> X field becomes 0xF8, false -> stays 0x07

  if (!overrideY) {
    // High roll: the second object's step-direction latch selects between a re-roll and the Y
    // override.
    if (((mem.read8(M50_OBJ2_STEP_DIR) - 1) & 0xff) !== 0) {
      // Step direction is not 1: a SECOND roll, whose "below 0x68" drives the X override while Y
      // keeps its default.
      stirRandomSeed(m);
      overrideX = regs.a < 0x68;
    } else {
      // Step direction is 1: fall into the Y-override arm.
      overrideY = true;
    }
  }

  if (overrideY) {
    mem.write8((slot + OBJ_Y) & 0xffff, 0xcc);
    // On this arm the X override follows the top bit of the third object's step-direction latch.
    overrideX = (mem.read8(M50_OBJ3_STEP_DIR) & 0x80) !== 0;
  }

  // X field: default 0x07, overridden to 0xF8 on either arm's carry.
  mem.write8((slot + OBJ_X) & 0xffff, 0x07);
  if (overrideX) mem.write8((slot + OBJ_X) & 0xffff, 0xf8);

  // Bring the record to life.
  mem.write8((slot + OBJ_ACTIVE) & 0xffff, 0x01);
  mem.write8((slot + OBJ_SPRITE_CODE) & 0xffff, 0x4b);
  mem.write8((slot + OBJ_HIT_EXTENT_X) & 0xffff, 0x08);
  mem.write8((slot + OBJ_HIT_EXTENT_Y) & 0xffff, 0x03);

  // Reload the cooldown timer and clear the consumed request.
  mem.write8(OBJ_SPAWN_TIMER, 0x7c);
  mem.write8(OBJ_SPAWN_REQ, 0x00);

  // Spawn-path shared decrement tail: the seed stirrer left the pointer at SPIN_COUNT.
  mem.write8(SPIN_COUNT, (mem.read8(SPIN_COUNT) - 1) & 0xff);
}
