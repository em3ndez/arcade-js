// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { markHitFlagSeedActorAndScanEnemyRecords } from "./markHitFlagSeedActorAndScanEnemyRecords.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
/**
 * testKindF0TightOverlap  ==  tight bounding-box proximity test for the 0xf0 dispatch kind.
 * ROM 0x630f-0x6342.  Grounding: [code].
 *
 * WHAT IT IS
 *   The narrowest of the object-collision overlap tests. It measures the gap between a
 *   moving actor box (the record at IX) and a single target (the record at IY) on both
 *   screen axes and decides one thing: are the two close enough on BOTH axes to count as a
 *   hit? Each gap must fall strictly inside a 5-pixel window; either axis out of range is a
 *   miss.
 *
 * ROLE IN THE MACHINE
 *   This is the leaf reached from the per-record collision handler (resolveOddRoundCollisionAndAward) when the
 *   matched target slot's state byte carries the high nibble 0xf0 — one specific kind of
 *   collidable object. The handler's own general proximity gate accepts a looser box (X gap
 *   under 9, Y gap under 8); this kind instead demands the tighter 5x5 overlap below before
 *   it will register a strike. A miss rejoins the record-by-record scan at its loop step
 *   (loc_60f2), which advances to the next actor/target pair and keeps sweeping. A hit hands
 *   off to markHitFlagSeedActorAndScanEnemyRecords (ROM 0x60d9), which raises the
 *   interrupt-parity hit flag, seeds a fresh actor record, and runs the enemy-record scan
 *   that actually resolves the collision.
 *
 * THE GEOMETRY
 *   The actor's X is shifted by a screen-orientation registration bias so its hit box lands
 *   on the same on-screen spot whichever way the cabinet paints the picture: +6 pixels when
 *   upright, -2 when the screen is mirrored. Both Y coordinates are lifted by a fixed +8
 *   margin before the compare, aligning the actor's and the target's coordinate frames.
 *   Every intermediate value is wrapped to 8 bits, mirroring the Z80 byte arithmetic, so the
 *   distance test behaves the same at the 0/255 wrap boundary as it does on hardware.
 *
 * LIVE-OUT: a boolean forwarded straight up out of the scan — true = normal completion (the
 * walk finished with no early hit-branch abort), false = a caller-skip deeper in the scan
 * wants the caller's frame unwound. No CPU register is left meaningful to the caller; the
 * pointers and count carried in through the parameters live only for the duration of the walk
 * (hl = the actor record pointer, ix = the paired sprite slot, count = the remaining-record
 * tally, iy = the target record, ireg = the interrupt-register parity that selects which
 * hit-flag slot the resolver marks).
 */
// The proximity window: a hit needs the gap on BOTH axes strictly under 5 pixels. On the Z80
// this is the `cp 0x05` / `jp nc` pair — a set carry (value below 5) keeps the record alive as
// a hit candidate; no carry (5 or more) rejects it as a miss.
const GAP_LIMIT = 0x05;

export function testKindF0TightOverlap(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Screen-orientation registration bias for the actor's X. FLIP_SCREEN_FLAG (0x881f) is 1 for
  // the normal upright cabinet and 0 when the screen is mirrored; the actor's hit box is
  // anchored +6 pixels upright / -2 flipped so it covers the same real spot either way (ROM
  // 0x6311-0x6319: E defaults to +6, and the `and a` test on 0x881f rewrites it to -2 when 0).
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  // The actor box's origin. Screen X lives at IX+0 (shifted by the flip bias above) and screen Y
  // at IX+2, lifted by the same +8 margin the target Y gets so the two coordinate frames line up.
  // Both are wrapped to 8 bits to reproduce the Z80 byte adds (ROM 0x631c-0x6324).
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  // Horizontal proximity: |target X (IY+0) - actor X|. A gap of 5 or more pixels puts the target
  // outside the box, so this record is a miss — rejoin the scan's loop step (loc_60f2), which
  // steps to the next actor/target pair and keeps sweeping (ROM 0x6327-0x6331: sub, a conditional
  // neg for the absolute value, then cp 5 / jp nc out to the miss tail).
  if (Math.abs(mem8[iy] - ax) >= GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Vertical proximity: |(target Y (IY+2) + 8) - actor Y|. The same +8 lift on the target Y and
  // the same 5-pixel window; out of range is again a miss back to the scan loop step, which drops
  // this record and moves on (ROM 0x6334-0x6340).
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Both axes inside the 5x5 window: a hit. Hand off to the strike resolver, which raises the
  // interrupt-parity hit flag (0x8d1c when ireg is set, else 0x8d1b), seeds a fresh actor record,
  // and scans the enemy records to resolve the collision (ROM 0x6340 -> jp 0x60d9). Its boolean —
  // false to abort the frame, true to continue — is forwarded straight up.
  return markHitFlagSeedActorAndScanEnemyRecords(m, hl, ireg); // hit
}
