// SPDX-License-Identifier: GPL-3.0-only
/**
 * service50mObjectSpawnRequest — service the 50m moving-object spawn request, paced by a cooldown timer.  ROM 0x2523.
 *
 * Reached only on 50m (its caller sub_24ea is board-gated) and run each pass while a
 * spawn may be pending. It first gates on a cooldown timer (OBJ_SPAWN_TIMER): while the
 * timer is still running it simply ticks it down and returns. Once the timer has drained
 * it looks at the spawn request (OBJ_SPAWN_REQ, a whole-byte "nonzero = requested" test):
 * with no request it returns untouched; with a request it scans the six-record
 * OBJ_ARRAY_65A0 (stride 0x10) for a free slot — one whose active-flag bit0 is clear. If
 * every slot is busy it gives up. Otherwise it brings the first free slot to life:
 *
 *   - Rolls the pseudo-random seed (stirRandomSeed) and, from that roll plus two of the
 *     50m step-direction latches, chooses the spawned record's Y field (0x7C default, or
 *     0xCC) and its X field (0x07 default, or 0xF8):
 *       * a roll below 0x60                              -> the 0xCC-Y arm;
 *       * a roll >= 0x60 with M50_OBJ2 step-dir == 1     -> the same 0xCC-Y arm;
 *         on the 0xCC-Y arm the X override follows bit7 of the M50_OBJ3 step-dir latch;
 *       * a roll >= 0x60 with M50_OBJ2 step-dir != 1     -> a SECOND roll whose "< 0x68"
 *         decides the X override, keeping the 0x7C Y.
 *   - Stamps the record's activate flag, sprite code, and two further fixed fields, reloads
 *     the cooldown timer to 0x7C, and clears the request.
 *
 * SHARED DECREMENT TAIL: the oracle's timer-running path and its spawn path converge on a
 * single `dec (hl)`, and HL differs by path — on the timer path it still points at
 * OBJ_SPAWN_TIMER, but on the spawn path it is the pointer stirRandomSeed leaves behind
 * (its closing load of SPIN_COUNT, 0x6019). Nothing on the spawn path moves that pointer
 * before the decrement, so the freshly-reloaded timer stays 0x7C and SPIN_COUNT is what
 * ticks down by one. Reproduced here as two explicit decrements of the two known cells.
 * The two no-op returns (no request / no free slot) decrement nothing.
 *
 * REGISTER-ABI MARSHALLING: stirRandomSeed hands its fresh seed back in the accumulator
 * (its documented live-out); this routine reads regs.a immediately after each call,
 * exactly where the oracle's `cp` consumes it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2523.test.js.
 * GATE:     crafted-only, because the routine is 50m-gated and is never dispatched in
 *           attract (0 dispatches over 4000 attract frames) — so there is no captured arm.
 *           Coverage: the timer-running tick, both no-op returns (no request / all slots
 *           busy), every free-slot position, and an exhaustive 256-value seed sweep across
 *           both spawn-roll arms with the two step-dir latches set both ways (so every
 *           X/Y-override combination is exercised). The candidate direct-calls
 *           stirRandomSeed (no push), so the oracle's dead push/call/ret STACK_SCRATCH
 *           churn on the spawn path is excluded from the RAM diff. Teeth: a twin that
 *           decrements the timer on the spawn path instead of SPIN_COUNT (wrong dec
 *           target) and a twin that drops the X override.
 * LIVE-OUT: memory only. The oracle's residual registers/flags and its terminal `ret` are
 *           dead ABI — the caller (sub_24ea) resumes its own work without reading them.
 * NAMES:    OBJ_SPAWN_TIMER (0x639B), OBJ_SPAWN_REQ (0x639A), OBJ_ARRAY_65A0 (0x65A0),
 *           OBJ_ACTIVE (+0), OBJ_X (+3), OBJ_Y (+5), OBJ_SPRITE_CODE (+7),
 *           M50_OBJ2_STEP_DIR (0x62A3), M50_OBJ3_STEP_DIR (0x62A6), SPIN_COUNT (0x6019) —
 *           all from ram.js. The spawned record's +9 and +0x0A fields have no ram.js name;
 *           they are stamped to fixed constants and reached as raw offsets (flagged below).
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
  OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y,} from "./ram.js";
import { stirRandomSeed } from "./stirRandomSeed.js"; // ROM 0x0057

const SLOT_STRIDE = 0x10; // OBJ_ARRAY_65A0 record stride
const SLOT_COUNT = 6;     // records scanned for a free slot
// Two spawned-record fields with no ram.js name yet, stamped to fixed constants; reached as
// raw record offsets so their omission from ram.js stays visible (for the lead to name later).

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
    // roll >= 0x60: the M50_OBJ2 step-dir latch selects between a re-roll and the Y override.
    if (((mem.read8(M50_OBJ2_STEP_DIR) - 1) & 0xff) !== 0) {
      // step-dir != 1: a SECOND roll; "< 0x68" drives the X override, Y stays 0x7C.
      stirRandomSeed(m);
      overrideX = regs.a < 0x68;
    } else {
      // step-dir == 1: fall into the Y-override arm.
      overrideY = true;
    }
  }

  if (overrideY) {
    mem.write8((slot + OBJ_Y) & 0xffff, 0xcc);
    // On this arm the X override follows bit7 of the M50_OBJ3 step-dir latch.
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

  // Spawn-path shared decrement tail: stirRandomSeed left the pointer at SPIN_COUNT.
  mem.write8(SPIN_COUNT, (mem.read8(SPIN_COUNT) - 1) & 0xff);
}
