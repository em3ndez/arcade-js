// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c8f — the 25m barrel-release entry in the per-frame update cascade: step the release
 * renderer when a barrel is already going out, otherwise find a free barrel record for an
 * armed release.  ROM 0x2C8F.
 *
 * Called from the shared per-frame update cascade (ROM 0x197A) — its only caller — immediately
 * before scheduleBarrelRelease. Four gates decide what it does:
 *
 *   1. Board mask 1 (boardBitGate): only 25m runs this, so the whole routine is skipped on
 *      50m/75m/100m.
 *   2. Mario alive (marioActiveGuard).
 *   3. bit0 of the cluster's event gate (0x6393) SET — a barrel already went out this pass —
 *      hands straight to advanceBarrelRelease and scans nothing. releaseBarrelIntoFreeSlot
 *      raises that bit as it claims a slot, and activateReleasedBarrel clears it again.
 *   4. bit0 of the release-armed scratch (0x6392) CLEAR — nothing armed — returns. That byte
 *      is raised by armBarrelRelease and cleared by activateReleasedBarrel and by the
 *      fresh-board reset (ROM 0x0763).
 *
 * With all four open it walks the ten OBJ_ARRAY_67 barrel records (stride 32) counting 10 down
 * to 1, and stops at the first whose OBJ_ACTIVE has BOTH low bits clear — neither already in
 * motion (bit 0) nor already claimed (bit 1). The record and the countdown go to
 * releaseBarrelIntoFreeSlot, which turns the count into that record's index. Ten records with
 * none free returns having written nothing.
 *
 * NAME: kept loc_ — an English name is earned in a confirmed understanding pass, not here.
 * WHAT THIS FILE DOES NOT CLAIM: the two scratch bytes' roles above are read off the siblings
 * that write them (armBarrelRelease, releaseBarrelIntoFreeSlot, activateReleasedBarrel,
 * restartAttractDemoAt25m), not from a grounding run of this routine; neither byte is named in names.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c8f.test.js.
 * GATE:     ATTRACT ONLY (plus pokes on top of attract state) — no credited game, and the
 *           other three boards are reached only by poking BOARD, which is itself one of the
 *           arms under test. Real captured 0x2C8F dispatches: MEASURED 2614 in 6000 frames
 *           across 11 distinct entry shapes, of which 141 were replayed — every 20th dispatch
 *           plus the first of each shape, with the test asserting in-run that the sample covers
 *           every shape the run saw. Attract reaches the renderer hand-off, the not-armed
 *           return, the Mario-dead skip, and claims at slots 0..7. PLUS crafted entries built
 *           on a real capture by poking identically on both sides for the arms it never
 *           reaches: the board gate closed on 50m/75m/100m, a ten-record scan that finds
 *           nothing free, claims at slots 8 and 9, and two records that must be skipped for
 *           being already claimed rather than in motion. The diff is RAM − STACK_SCRATCH (the
 *           oracle's push/ret churn) plus the return value; the register hand-off is pinned
 *           through the two words the claim writes it to. Teeth: three broken twins.
 *           OBSERVED FAILING against THIS file, not only against the twins: dropping the
 *           bit-1 test failed the crafted occupied-record arm (`skip an occupied record
 *           (bit 1 only): RAM@0x62aa oracle=32 cand=0`) — the captured replay does NOT catch
 *           that one, because attract never parked an occupied record in front of a free one —
 *           and handing the claim `remaining + 1` failed the captured replay (`captured
 *           dispatch [board=1 alive=1 gate=0 armed=1 claim@0]: RAM@0x62ac oracle=128
 *           cand=124`).
 * LIVE-OUT: memory-only. The one caller (ROM 0x197A — the only call site of 0x2C8F anywhere in
 *           the tree) discards the return value; its next act is scheduleBarrelRelease, which loads
 *           the accumulator before its first read, so no register or flag this routine leaves
 *           is read back. The record base and the countdown handed to
 *           releaseBarrelIntoFreeSlot are internal to that direct call and land in RAM anyway
 *           (the record base in RENDER_OBJ_PTR, the count-derived sprite slot in
 *           RENDER_DST_PTR), so the gate pins them there. This live-out is DERIVED, and the
 *           derivation is what the gate checks; there is no committed live-wire arm here.
 * NAMES:    OBJ_ARRAY_67 (0x6700) and the record field OBJ_ACTIVE (+0) from names.js — names.js's
 *           own entry for that array names this routine as one of its three walkers.
 *           boardBitGate (ROM 0x0030), marioActiveGuard (ROM 0x0010), advanceBarrelRelease
 *           (ROM 0x2D15) and releaseBarrelIntoFreeSlot (ROM 0x2CB8) are all direct-called.
 *           0x6393 and 0x6392 are UNNAMED in names.js, so both stay local hex consts here — the
 *           same convention as the siblings scheduleBarrelRelease, armBarrelRelease and
 *           activateReleasedBarrel, which read and write the same two bytes.
 *
 * REGISTER-ABI MARSHALLING (dissolves once releaseBarrelIntoFreeSlot takes honest args): that
 * callee reads the free record and the countdown from registers, so this routine loads exactly
 * what the oracle leaves for it at the hand-off. advanceBarrelRelease reads no incoming
 * register, so its hand-off needs no marshalling.
 */

import { boardBitGate } from "./boardBitGate.js";                         // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js";                 // ROM 0x0010 (rst 0x10)
import { advanceBarrelRelease } from "./advanceBarrelRelease.js";         // ROM 0x2D15
import { releaseBarrelIntoFreeSlot } from "./releaseBarrelIntoFreeSlot.js"; // ROM 0x2CB8
import { OBJ_ARRAY_67, OBJ_ACTIVE } from "./names.js";

const BOARD_MASK = 1;          // rst-0x30 applicability mask: bit0 = 25m only
const EVENT_GATE = 0x6393;     // bit0 SET -> a barrel already went out this pass (unnamed scratch)
const RELEASE_ARMED = 0x6392;  // bit0 SET -> a release is armed for this pass (unnamed scratch)
const BARREL_SLOTS = 10;       // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32;      // bytes per object record
const SLOT_ACTIVE = 0x01;      // OBJ_ACTIVE bit 0 — the record is a barrel already in motion
const SLOT_OCCUPIED = 0x02;    // OBJ_ACTIVE bit 1 — the record is claimed but not yet moving

export function loc_2c8f(m) {
  const { regs, mem8 } = m;

  // Only 25m runs this, and only while Mario is alive. boardBitGate reads the mask.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;
  if (!marioActiveGuard(m)) return;

  // A barrel is already going out this pass -> step the renderer, look for nothing.
  if ((mem8[EVENT_GATE] & 0x01) !== 0) return advanceBarrelRelease(m);

  // Nothing armed -> nothing to place.
  if ((mem8[RELEASE_ARMED] & 0x01) === 0) return;

  // Walk the ten barrel records for the first that is neither moving nor already claimed. The
  // walk counts DOWN, because the claim derives the record's index from what is left.
  let record = OBJ_ARRAY_67;
  for (let remaining = BARREL_SLOTS; remaining > 0; remaining--) {
    if ((mem8[record + OBJ_ACTIVE] & (SLOT_ACTIVE | SLOT_OCCUPIED)) === 0) {
      regs.ix = record;   // the free record
      regs.b = remaining; // and the countdown it turns into that record's index
      return releaseBarrelIntoFreeSlot(m);
    }
    record += RECORD_STRIDE;
  }

  // Ten records, none free: nothing to release this pass.
}
