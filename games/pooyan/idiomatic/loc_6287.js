// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { markHitFlagSeedActorAndScanEnemyRecords } from "./markHitFlagSeedActorAndScanEnemyRecords.js";
import { applyRoundDeltaAndRearmMatchedRecord } from "./applyRoundDeltaAndRearmMatchedRecord.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import {
  FLIP_SCREEN_FLAG,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  POSITION_DELTA_TABLE_6360,
  ANIM_SCRIPT_6349,
} from "./names.js";
/**
 * loc_6287 — proximity gate and award for the 0x50 / 0xd0 collision dispatch kinds.
 *
 * WHAT IT IS
 * ----------
 * A leaf of the enemy/projectile collision pipeline. Every on-screen enemy owns a 0x18-byte
 * actor record; within a record +0x00 is its screen-X, +0x02 its screen-Y, +0x0a a signed
 * position field, and +0x14 the collision tag a shot is matched against. When the per-record
 * collision handler (loc_61b4) finds a target slot whose state byte carries dispatch kind 0x50
 * or 0xd0, it routes here with that kind in `kind`, the record in `hl`/`ix`, and the target slot
 * in `iy`.
 *
 * The routine first runs the same flip-biased bounding-box proximity test the rest of the
 * collision code uses: if the actor and target are too far apart on either axis it is not a real
 * hit, and control skips this record and continues the scan. If they are close enough, the two
 * dispatch kinds diverge:
 *   - kind 0x50 engages the hit directly — flag the hit, birth its actor record, and resolve
 *     which enemy was struck;
 *   - the other kind (0xd0) runs the "award" path — latch the actor onto the record, install a
 *     fresh animation, nudge the record's position by the current round's delta, and hand off to
 *     the re-arm tail that re-launches the enemy and retires the spent target slot.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is one arm of how a landed shot turns into an enemy response (see mechanisms.md, the
 * object-proximity collision scan). The proximity box decides whether the actor and target
 * actually overlap in screen space; the round-indexed position delta shifts the re-launched
 * enemy by an amount that grows with the round, one strand of the game's per-round difficulty
 * ramp.
 *
 * ROM 0x6287-0x62e5.
 * Grounding: [code].
 *
 * LIVE-OUT: a boolean forwarded up out of the scan — true = normal completion (the scan carries
 * on to the next record), false = a caller-skip must unwind the caller's frame. On the award
 * path it also writes the record's animation-script pointer/frame, adds the round delta into the
 * record's +0x0a field, and (through the re-arm tail) sets the record's re-arm bit and clears the
 * interrupt-parity target buffer. No CPU register is left meaningful to the caller.
 */
// Proximity box half-widths, in screen pixels: the actor and target must be within 6 px on X and
// 7 px on Y for the record to count as a hit; a gap that reaches the limit misses.
const X_GAP_LIMIT = 0x06;
const Y_GAP_LIMIT = 0x07;
// Dispatch kind that engages the hit directly rather than taking the award path.
const DIRECT_KIND = 0x50;
// Record field +0x0a: the signed position value the round delta is added into.
const DELTA_FIELD = 0x0a;
// Record field +0x14: the collision tag used to re-find this enemy's record in the re-arm tail.
const TAG_OFFSET = 0x14;
// The re-arm tail searches the enemy-actor pool by tag: 6 records, one 0x18-byte stride apart.
const REARM_SLOTS = 0x06;
const REARM_STRIDE = 0x18;

export function loc_6287(m, kind = m.regs.a, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Shift the actor's hit box by a flip-dependent bias so it lines up in screen space regardless
  // of screen orientation. FLIP_SCREEN_FLAG (0x881f) is 1 for the normal upright cabinet and 0
  // when the picture is mirrored; the machine adds +6 to the actor X when upright, -2 when
  // mirrored. The biased actor X and the actor Y (recentred +8 onto the sprite's mid-row) form
  // the box this record's target is tested against.
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  // X-axis proximity: if the target X (iy+0) is 6 px or more from the biased actor X, this is a
  // miss — skip the record and re-enter the scan through loc_60f2 (the scan's loop-step tail).
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Y-axis proximity: the target Y (iy+2) is recentred +8 to match ay, and the &0xff reproduces
  // the hardware's 8-bit wrap of that add. A gap of 7 px or more misses and continues the scan.
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Inside the box: kind 0x50 engages the hit directly — mark the interrupt-parity hit flag,
  // seed a fresh actor record, and scan the enemy records to resolve which enemy was struck. Its
  // boolean (false = frame unwound, true = continue) is forwarded straight up.
  if (kind === DIRECT_KIND) return markHitFlagSeedActorAndScanEnemyRecords(m, hl, ireg);

  // Award path (kind 0xd0): latch the actor onto this record and point it at animation script
  // 0x6349, rewound to its first step, so the enemy re-enters its motion passes playing that
  // sequence next frame.
  setActorAnimation(m, hl, ANIM_SCRIPT_6349);
  // Pick the per-round position delta: the low 3 bits of ROUND_COUNTER (0x8907) halved give an
  // index 0..3 into POSITION_DELTA_TABLE_6360 (ROM 0x6360), a table of signed per-round nudges.
  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [delta] = fetchByteFromTableIndex(m, POSITION_DELTA_TABLE_6360, index);
  // Nudge the record's signed +0x0a position field by that round delta — the per-round shift of
  // where the re-launched enemy re-appears.
  mem8[u16(hl + DELTA_FIELD)] = mem8[u16(hl + DELTA_FIELD)] + delta;
  // Hand off to the re-arm tail: re-find the record by its collision tag (+0x14) among the 6
  // enemy-actor records (ENEMY_ACTOR_TABLE 0x8ae0, stride 0x18), apply the delta again, set the
  // record's re-arm bit and animation, then clear the interrupt-parity target buffer and unwind
  // the frame. Its boolean is this routine's result.
  return applyRoundDeltaAndRearmMatchedRecord(m, mem8[u16(hl + TAG_OFFSET)], ENEMY_ACTOR_TABLE, REARM_SLOTS, REARM_STRIDE);
}
