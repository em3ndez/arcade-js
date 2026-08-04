// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20ec — step one airborne object along its arc, then decide whether this is a frame on which
 * it is allowed to test the girder underneath it.  ROM 0x20EC.
 *
 * One of the five branches ROM 0x1F93 dispatches for an active object slot, and like its four
 * siblings it opens by swapping to the shadow register set. That swap is the object loop's register
 * contract, not decoration: the loop at ROM 0x1F72 keeps its cursor, record pointer, stride and slot
 * counter in the main set, each branch works in the shadow set without swapping back, and the shared
 * tail at ROM 0x21BA swaps them home for the next slot. Dropping it here does not merely change a
 * register — measured, an attract run wired that way stops at frame 606 of 1400 writing to ROM,
 * because the loop's own cursor has been overwritten.
 *
 * After the ballistic step it picks one of three continuations:
 *
 *   - the object has not yet moved 26 units of OBJ_Y past the point where it last registered a
 *     girder contact  ->  ROM 0x2104, which only checks whether the object has run off the edge
 *   - it has moved that far and the tile under it is a slope it touches  ->  ROM 0x2118
 *   - it has moved that far and there is no contact  ->  ROM 0x2101
 *
 * THE 26-UNIT GATE, and what it rests on. Record byte +25 has exactly one writer in this object
 * cascade — ROM 0x2146, on the arm the CONTACT continuation above leads to — and what it stores
 * there is a copy of the record's own OBJ_Y. So +25 is a snapshot of where the object was when it
 * last registered a contact, and this comparison holds the contact probe off until OBJ_Y has moved
 * 26 past that snapshot: a re-arm distance, so an object cannot immediately re-detect the girder it
 * has just landed on. Corroborated by measurement rather than by this body alone: over a 1200-frame
 * attract run the suppressed arm is taken on exactly the 140 dispatches where OBJ_Y is less than 26
 * past the snapshot, and on none of the other 37. (ROM 0x32D6 also zeroes a +25, but on the record
 * family reached through 0x63C8, not through the slot array this branch walks.)
 *
 * NOT CLAIMED: why the distance is 26 and not some other number; what distinguishes the two
 * probe-passed continuations for the object (that is ROM 0x2118 / 0x2101's business); and whether
 * the 8-bit wrap below is intended. The subtraction is 8-bit, so an object whose OBJ_Y is under 26
 * wraps to a large value and PASSES the gate instead of failing it. Attract never produces one — the
 * lowest OBJ_Y reaching here is 77 — so the wrap arm is reached only by a crafted entry, and whether
 * the ROM relies on it or merely never meets it is unknown.
 *
 * Reads record byte +25 and nothing else of its own; writes no memory. Every cell that changes is
 * written by the ballistic step, by the slope probe, or by the continuation. The record pointer
 * stays in the index register rather than becoming a parameter: all three still-frozen continuations
 * read it straight off the machine, and so do both callees, so a caller passing anything else would
 * be obeyed by nobody. It becomes an honest parameter once the continuations are decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-20ec.test.js.
 * GATE:     ATTRACT captures + crafted boundary and wrap entries + a stubbed protocol replay. A
 *           1200-frame attract run dispatches this 177 times across 136 distinct entry shapes, all
 *           on record base 0x6700, and ALL 177 are replayed inline at the dispatch, oracle against
 *           rewrite on byte-identical rehosted machines — nothing is sampled. Attract covers all
 *           three continuations by itself (0x2104 x140, 0x2101 x31, 0x2118 x6, arm labels taken
 *           from the oracle), so no craft is needed to reach an arm; the crafted entries (708
 *           replays) exist for the two frontiers attract does NOT provide — the exact re-arm
 *           boundary in both directions, and the sub-26 OBJ_Y that makes the subtraction wrap. A
 *           third arm replaces all three continuations with stubs on each fresh machine and
 *           compares the call sequence and the handed-back value against the same stubs driven by
 *           the oracle; it is the only check with teeth on the return value, because the oracle
 *           returns undefined on all 177 real dispatches. Finally the rewrite drives a whole
 *           1400-frame cycle-free attract run live (279 dispatches) against a baseline wired with
 *           the same two idiomatic callees and only this routine swapped.
 *           NOT covered: credited play and boards past 25m — attract reaches neither, and no other
 *           record base activates this branch. Teeth: four broken twins, and the arms catch
 *           disjoint sets (details in the test header).
 * LIVE-OUT: the return value only — everything else is dropped, derived and measured. The oracle
 *           leaves the accumulator holding the gate's difference and the shadow B holding the +25
 *           snapshot; both are dead. DERIVED: every continuation overwrites the accumulator with its
 *           first instruction (ROM 0x2104 and 0x2118 load it from the record, ROM 0x2101 reaches ROM
 *           0x24B4 which does the same), and every routine reachable before ROM 0x21BA swaps the
 *           banks back either never touches B or writes B/BC before reading it (ROM 0x1FE5, 0x1FEF,
 *           0x215F, 0x2407) — the one genuine read, the loop's own slot counter at ROM 0x1F8D, runs
 *           after that swap and so reads the main-set copy, not this one. MEASURED: the live-wire
 *           run reproduces the baseline byte-for-byte on the full dump over 1400 frames with the
 *           shadow-B write dropped. The flags are dead for the same reason as the accumulator.
 *           The tail's own return value is forwarded rather than swallowed, and the stubbed protocol
 *           arm is what proves that.
 * NAMES:    none imported. Record byte +25 has no names.js entry (see the constant below); OBJ_Y is
 *           named there and is what the ballistic step advances, but this routine never addresses
 *           it — it takes the stepped value from the callee.
 */

import { u8 } from "../../../core/int.js";
import { loc_2a2f } from "./loc_2a2f.js"; // ROM 0x2A2F — the girder/slope probe
import { stepBallisticMotion } from "./stepBallisticMotion.js"; // ROM 0x239C

/** Object-record byte +25: the OBJ_Y the object had at its last registered contact (no names.js
 *  name — the only writer is the still-frozen ROM 0x2146, so the field is not yet grounded well
 *  enough to earn a registry entry; the lead may decide it is). */
const OBJ_CONTACT_Y = 25;

/** How far OBJ_Y must move past that snapshot before the contact probe is armed again. */
const CONTACT_REARM_DISTANCE = 26;

export function loc_20ec(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  // Into the shadow set for the whole branch; the shared tail swaps back. See the header.
  regs.exx();

  // Advance the object one frame along its arc. It hands the new OBJ_Y back in a register as well
  // as storing it into the record — this is the call site that consumes that live-out.
  stepBallisticMotion(m);
  const objectY = regs.h;

  // Still too close to where the object last touched down: skip the probe entirely and let the
  // off-the-edge check have it. The subtraction wraps at 8 bits (see NOT CLAIMED in the header).
  const lastContactY = mem8[record + OBJ_CONTACT_Y];
  if (u8(objectY - CONTACT_REARM_DISTANCE) < lastContactY) return m.call(0x2104);

  // Far enough: probe the tile under the object, and split on whether it made contact.
  if (loc_2a2f(m)) return m.call(0x2118);
  return m.call(0x2101);
}
