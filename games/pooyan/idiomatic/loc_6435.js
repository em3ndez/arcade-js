// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand06 } from "./queueSoundCommand06.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { loc_64be } from "./loc_64be.js";
import {
  PLAY_MODE_LATCH,
  FLIP_SCREEN_FLAG,
  SPRITE_TARGET_SLOTS,
  SPRITE_TARGET_SLOTS_P1,
  SPAWN_OBJECT_TABLE,
  PROJECTILE_TABLE,
  OBJ_HIT_FLAG_I0,
  OBJ_HIT_FLAG_I1,
  HIT_TALLY,
  HUNTER_SPAWN_DISPLAY_CMD,
  ANIM_SEQ_64DF,
  TERMINATOR_SCAN_SRC,
  TERMINATOR_MATCH_TABLE,
} from "./names.js";

// ---------------------------------------------------------------------------
// Collision-box geometry — the tuning constants for the proximity test below.
//
// The scan walks three parallel object slots per pass: the coordinate slots that
// hold each object's screen position sit COORD_STRIDE (4) bytes apart, and the
// object records that hold its live/state bytes sit RECORD_STRIDE (0x18) apart.
// An object counts as touching the actor only when the distance on BOTH axes is
// below NEAR_LIMIT (7 pixels). Before the compare the object's Y is nudged by
// Y_BIAS (+8) to align the two coordinate frames, and its X by the flip-dependent
// registration offset — X_BIAS_FLIPPED (+5) or X_BIAS_NORMAL (-2) — so the hit box
// stays put whichever way the cabinet paints the screen.
// ---------------------------------------------------------------------------
const SCAN_SLOTS = 3; // records tested per pass
const COORD_STRIDE = 0x04; // between coordinate slots
const RECORD_STRIDE = 0x18; // between object records
const NEAR_LIMIT = 0x07; // a hit needs the axis magnitude below this
const Y_BIAS = 0x08; // added to both actor and object Y before comparing
const X_BIAS_NORMAL = 0xfe; // object-X bias when not flipped (-2)
const X_BIAS_FLIPPED = 0x05; // object-X bias when flipped (+5)

/**
 * loc_6435 — the per-actor proximity/collision scan (ROM 0x6435-0x64bd).
 *
 * WHAT IT IS
 *   One frame's collision test for a single actor — the actor whose coordinate
 *   record is addressed by `iy` — against a bank of spawned objects / projectiles.
 *   It is the innermost step of the object-proximity collision subsystem:
 *   scanActorCollisionsBothSlots drives it twice per frame (once per actor box),
 *   and a reported collision aborts that whole driver for the frame.
 *
 * ROLE IN THE MACHINE
 *   It first chooses which object bank to test from PLAY_MODE_LATCH (0x8f50). With
 *   the latch clear it takes the player-1 pair — the coordinate slots
 *   SPRITE_TARGET_SLOTS_P1 (0x888c) against the spawned-object table
 *   SPAWN_OBJECT_TABLE (0x8c48); with the latch set it takes the other pair,
 *   SPRITE_TARGET_SLOTS (0x887c) against the projectile table PROJECTILE_TABLE
 *   (0x8be8). It then tests up to SCAN_SLOTS (3) objects: an object registers a hit
 *   only when its record is active (record byte 0 nonzero) and its biased X and Y
 *   both fall within NEAR_LIMIT (7 pixels) of the actor. No hit anywhere returns
 *   true so the caller keeps sweeping; the first hit tears the struck object down,
 *   marks it, plays its destruction, tallies it, and returns false to unwind the
 *   caller's scan.
 *
 * GROUNDING (conveyed by the names.js cert tags of the cells it touches)
 *   The object banks it scans and empties — SPAWN_OBJECT_TABLE, PROJECTILE_TABLE —
 *   and the per-slot hit flags OBJ_HIT_FLAG_I0 / OBJ_HIT_FLAG_I1 (0x8d1b / 0x8d1c)
 *   are [seen]; the running HIT_TALLY (0x8f52) it bumps is [code].
 *
 * LIVE-OUT
 *   No register value survives for the caller — it resumes on its own preserved
 *   state. Everything lasting is in memory: the struck object record (its header,
 *   state and countdown cells cleared and reseeded), the selected I-parity hit
 *   flag, the object's animation fields, HIT_TALLY, and the queued sound / display
 *   effects. The only value the caller reads back is the boolean result: true means
 *   "no collision, keep scanning", false means "collision, abort the sweep".
 */

// farOnAxis — one axis of the box test. It returns the distance magnitude
// |actorVal - objVal| (formed the way the hardware does it: subtract, and on a
// borrow negate to recover the absolute value) and reports whether that magnitude
// reaches NEAR_LIMIT — i.e. whether the two points are too far apart on this axis
// to count as touching.
function farOnAxis(actorVal, objVal) {
  let d = (actorVal - objVal) & 0xff;
  if (actorVal < objVal) d = (0 - d) & 0xff; // borrow -> magnitude
  return d >= NEAR_LIMIT;
}

export function loc_6435(m, iy = m.regs.iy, regI = m.regs.i) {
  const { mem8 } = m;

  // Pick the object bank to scan from the play-mode latch PLAY_MODE_LATCH (0x8f50).
  // `coord` walks the coordinate slots (each object's screen position) and `record`
  // walks the object records (each object's live/state bytes). Latch clear -> the
  // player-1 pair (target slots 0x888c, spawned objects 0x8c48); latch set -> the
  // other pair (target slots 0x887c, projectiles 0x8be8).
  let coord;
  let record;
  if (mem8[PLAY_MODE_LATCH] === 0) {
    coord = SPRITE_TARGET_SLOTS_P1;
    record = SPAWN_OBJECT_TABLE;
  } else {
    coord = SPRITE_TARGET_SLOTS;
    record = PROJECTILE_TABLE;
  }

  // Walk up to three object slots, the coordinate pointer and the record pointer
  // advancing in lockstep. Skip any record whose active byte (record[0]) is zero;
  // for a live one bias the object's X by the flip-dependent offset selected by
  // FLIP_SCREEN_FLAG (0x881f) and its Y by +8, then it is a hit only when the actor
  // and the object land within NEAR_LIMIT on BOTH axes. The first hit wins and stops
  // the walk (leaving `hit` at the struck record's address).
  let hit = -1;
  for (let n = 0; n < SCAN_SLOTS; n++) {
    if (mem8[record] !== 0) {
      const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_FLIPPED : X_BIAS_NORMAL;
      const objX = (mem8[coord] + xBias) & 0xff;
      const objY = (mem8[coord + 2] + Y_BIAS) & 0xff;
      if (!farOnAxis(mem8[iy], objX) && !farOnAxis((mem8[iy + 2] + Y_BIAS) & 0xff, objY)) {
        hit = record;
        break;
      }
    }
    coord = u16(coord + COORD_STRIDE);
    record = u16(record + RECORD_STRIDE);
  }

  // Nothing in range this frame: report true so the caller keeps its own sweep going.
  if (hit < 0) return true; // no collision -> caller keeps its scan loop running

  // A collision. Tear the struck object's record down: clear its active byte
  // (record+0), reseed its state bytes (record+1 = 1, record+2 = 2), and set its
  // animation countdown (record+0x11 = 0x20) so the object plays out its destruction.
  mem8[hit] = 0x00;
  mem8[hit + 1] = 0x01;
  mem8[hit + 2] = 0x02;
  mem8[u16(hit + 0x11)] = 0x20;
  // Raise the hit flag for this object slot. Which of the two flag cells is used is
  // chosen by the interrupt-vector parity regI: OBJ_HIT_FLAG_I0 (0x8d1b) when 0, else
  // OBJ_HIT_FLAG_I1 (0x8d1c) — the object-teardown pass reads it back next frame.
  mem8[regI === 0 ? OBJ_HIT_FLAG_I0 : OBJ_HIT_FLAG_I1] = 0x01;
  // Play the destruction: point the struck record at the hit animation sequence
  // ANIM_SEQ_64DF (0x64df) and restart it, queue the fixed hit sound, and — only on
  // the player-1 path (PLAY_MODE_LATCH clear) — queue the hunter-spawn display
  // command HUNTER_SPAWN_DISPLAY_CMD (0x0315).
  setActorAnimation(m, hit, ANIM_SEQ_64DF);
  queueSoundCommand06(m);
  if (mem8[PLAY_MODE_LATCH] === 0) enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD);
  // Count the hit toward the end-of-level bonus tally HIT_TALLY (0x8f52).
  mem8[HIT_TALLY] = mem8[HIT_TALLY] + 1;
  // Hand off to the terminator guard loc_64be with its ROM match inputs
  // (TERMINATOR_SCAN_SRC 0x0bc2 vs TERMINATOR_MATCH_TABLE 0x64d0): it runs an
  // anti-tamper byte-match over that ROM window and always reports false, which
  // becomes this scan's collision result and unwinds the caller's sweep.
  return loc_64be(m, TERMINATOR_SCAN_SRC, TERMINATOR_MATCH_TABLE); // always false -> abort caller
}
