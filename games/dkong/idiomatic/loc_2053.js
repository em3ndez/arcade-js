// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2053 — the arc-travel branch of the OBJ_ARRAY_67 object sweep: carry one record a
 * frame further along its ballistic arc, then route on what that step ran it into.  ROM 0x2053.
 *
 * WHAT IT DOES, AND WHAT THAT RESTS ON. The sweep at ROM 0x1F72 walks the ten records of
 * OBJ_ARRAY_67 and hands each active one to a movement branch chosen by ROM 0x1F93; this is
 * the branch its dispatch chain falls through to. The body is four decisions in a row:
 *   • Advance the record one frame along its arc (stepBallisticMotion).
 *   • Probe the girder under it (loc_2a2f). On contact, control leaves for the sub-state
 *     machine at ROM 0x2083 and nothing below runs.
 *   • Otherwise retire the record if its X has come within 8 of zero — see below.
 *   • Otherwise run the bounds gate at ROM 0x24B4, refresh the sprite orientation
 *     (loc_23de), and hand off to the sweep's shared sprite tail at ROM 0x21BA.
 * THE ORDER IS LOAD-BEARING: the girder probe reads the position the arc step has ALREADY
 * written, and the retire test reads it after that again. That the probe's answer really does
 * route the record, rather than merely being consulted, is what the gate's ignored-contact twin
 * shows — running the probe and discarding its answer diverges the record's own bytes at capture
 * 62 of 1246.
 *
 * RETIRING THE RECORD. The test is one window on OBJ_X — 248..255 or 0..7 — so it catches the
 * coordinate walking down to zero and the coordinate wrapping past it with one comparison. The
 * arm it selects, ROM 0x2079, zeroes the record's OBJ_ACTIVE and its OBJ_X, and the sweep's
 * per-slot head at ROM 0x1F83 skips every record whose OBJ_ACTIVE is not 1 — so that arm takes
 * the record out of the sweep rather than merely moving it. WHY the object is finished at that
 * X, as opposed to at some other edge, is NOT established here.
 *
 * THE SELECTOR HANDED TO ROM 0x23DE is 0 or 4, taken from the low bit of the record's
 * horizontal-velocity high byte. Corroboration outside this body: the same callee's two other
 * branch entries in this sweep, ROM 0x1FE5 and ROM 0x1FEF, stage exactly those two values (0
 * and 4) for the same purpose, and loc_23de folds the value into the key of its packed
 * orientation lookup. What each of the two selects is not established here — loc_3009, which
 * consumes the key, records the meaning of its own constants as not established either.
 *
 * THE REGISTER-SET SWAP IS A CONTRACT. Every branch of this sweep swaps to the shadow set on
 * entry and reaches the shared tail WITHOUT swapping back; the swap at the head of ROM 0x21BA
 * is the one that puts the sweep's own loop state — its sprite cursor, record stride and
 * remaining count — back. Dropping the swap here would let this branch's work land on those
 * live loop registers instead; the gate's dropped-swap twin does exactly that and faults on the
 * very first captured dispatch, on an unmapped read.
 *
 * NAME: kept the neutral loc_ — the routing is pinned to the oracle, but what these records
 * are and what an arc-travelling one represents on screen is not established, so no English
 * name is earned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2053.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. 3000 attract frames dispatch this 1246
 *           times and ALL 1246 are replayed — no sampling, so there is no sampling policy to be
 *           wrong about, and that matters here: two of the six arms attract reaches occur ONCE
 *           each in those 1246. The captures span record slots 0-6 and every arm:
 *           bounds-gate-inline x1172, bounds-gate-splice x1, girder-contact x72 (all three of
 *           ROM 0x2083's own paths), retire x1. Two crafted entries — a real capture with ONE
 *           byte poked — drive the retire arm from each side of its wrap window, so that arm
 *           does not hang on a single natural sample; each asserts the arm it actually reached.
 *           The rewrite is then wired live at 0x2053 for the same 3000-frame run and every
 *           frame compared against the all-oracle baseline, with the oracle's measured cycle
 *           cost restored per dispatch. ALL OF IT IS ATTRACT — 25m only, slots 0-6; gameplay,
 *           the other boards and slots 7-9 are NOT covered. Teeth, all seven observed being
 *           caught: a dropped register-set swap, a girder probe whose answer is ignored, an
 *           unwrapped retire window, the retire test read off OBJ_Y, a selector scaled wrong, a
 *           dropped call bracket, and a splice whose skip is ignored.
 * LIVE-OUT: memory-only, plus WHICH ARM control leaves through. Every arm of both the oracle
 *           and this rewrite returns undefined, so a return-value assertion here is
 *           near-vacuous; the observable that replaces it is the arm, labelled from the
 *           ORACLE's own outgoing calls and asserted equal for the rewrite on all 1246
 *           captures. What this rewrite drops is the register state the oracle hands the frozen
 *           tails: B, C, D, E, H and L — the two idiomatic callees it direct-calls define memory
 *           plus the contact flag (and the stepped vertical position) as their contract and
 *           leave the rest.
 *           DERIVED: those six live in the shadow set, and the translated layer executes exactly
 *           six swaps into it — this sweep's five branch heads and ROM 0x21BA. No branch READS
 *           any of the six as a value carried over from the previous one: ROM 0x1FAC and its
 *           tail touch none of them at all; ROM 0x1FE5/0x1FEF stage a pair and their shared tail
 *           loads the rest from the record; and this branch and ROM 0x20EC both open with the
 *           arc step, which writes four of the six, while the girder probe writes the other two
 *           before reading them. That is also why the oracle's final increment of the pair it
 *           hands over is not performed here: nothing reads the result.
 *           MEASURED TWICE: a twin that scrambles exactly those registers immediately before
 *           EVERY hand-off is wired live for the same 3000-frame run and the trace stays
 *           byte-identical; and each captured replay carries the whole REMAINDER of the sweep
 *           on both sides, so a later branch reading one of them would surface as a RAM diff.
 *           Everything else holds and is asserted as an extra: pc, SP and the full main
 *           register file match on all 1246 captures, and the dropped-bracket twin is caught by
 *           pc and SP ALONE — RAM and the return value both miss it.
 * NAMES:    OBJ_X (record +3) from ram.js. The horizontal-velocity high byte at record +0x10 has
 *           no ram.js name and stays a file-local const. ROM 0x2083, 0x2079, 0x24B4 and 0x21BA
 *           have no idiomatic twin in ROUTINES yet — they are the rest of this sweep's cluster, decompiled
 *           in the same batch — so they are still reached through the registry, with the
 *           oracle's push bracket kept around the one of them that is entered by a call.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X } from "./ram.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js"; // ROM 0x239C
import { loc_2a2f } from "./loc_2a2f.js"; // ROM 0x2A2F
import { loc_23de } from "./loc_23de.js"; // ROM 0x23DE

/**
 * Record +0x10 — the high byte of the horizontal velocity stepBallisticMotion adds into OBJ_X
 * every frame. ram.js names no object-record field at this offset; its low bit is all this
 * routine reads, and only to pick the sprite-orientation selector.
 */
const OBJ_VELOCITY_X_HI = 0x10;

/** How close to zero OBJ_X may come before the record is retired: the window is 248..255, 0..7. */
const RETIRE_MARGIN = 8;

/**
 * @param {object} m       the machine.
 * @param {number} record  base address of the object record being carried. Published to the
 *                         machine below, so the still-frozen tails obey it too.
 * @returns {undefined}    on every arm; control flow, not a value, is what this hands on.
 */
export function loc_2053(
  m,
  record = m.regs.ix /* oracle-boundary default: caller ROM 0x1F93 still frozen */,
) {
  const { regs, mem8 } = m;

  // Into the shadow set — see the contract above. Nothing below swaps back; the shared tail does.
  regs.exx();

  // Everything downstream — both idiomatic callees and all four frozen tails — takes the record
  // out of the index register rather than as an argument, so publish it once here. A no-op on
  // the default, and the one line that makes the parameter above honest.
  regs.ix = record;

  // One frame further along the arc: the record's position and its airborne-frame counter.
  stepBallisticMotion(m);

  // Did that land it on a sloped girder? If so this branch is done — the sub-state machine at
  // ROM 0x2083 takes over and runs to the shared tail itself.
  if (loc_2a2f(m)) return m.call(0x2083);

  // Travelled to the edge: take the record out of the sweep (ROM 0x2079 clears its active flag).
  if (u8(mem8[record + OBJ_X] + RETIRE_MARGIN) < 2 * RETIRE_MARGIN) return m.call(0x2079);

  // The bounds gate at ROM 0x24B4. On its main path it splices PAST this routine — control never
  // comes back here — so its answer gates everything below. Still frozen and entered by a call,
  // so it keeps the oracle's return-address bracket; the bracket goes with it when this cluster's
  // calls are dissolved.
  m.push16(0x206b);
  if (!m.call(0x24b4)) return;

  // Refresh the sprite orientation. loc_23de still takes its selector off the machine, so stage
  // it there: 0 or 4, from the low bit of the horizontal velocity's high byte.
  regs.c = (mem8[record + OBJ_VELOCITY_X_HI] & 1) * 4;
  loc_23de(m);

  // The sweep's shared sprite tail (ROM 0x21BA), entered by a jump — no bracket, and its return
  // is this routine's return.
  return m.call(0x21ba);
}
