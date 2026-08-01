// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_271e — thin wrapper: run the vertical-reposition machine, then return.
 * ROM 0x271E.
 *
 * The whole routine is a single delegation. It reads and writes nothing of its
 * own; it hands control to loc_2745 — which gates on the reposition flag and
 * Mario's grounded state, then dispatches by Mario's X into the vertical mover
 * arms or the edge reset — and returns whatever that leaves behind. It is one of
 * the two bodies sub_26fa's position dispatch tail-jumps into.
 *
 * NAME: kept the neutral loc_. The delegation is exact against the oracle, but
 * which game event drives this reposition is not confirmed to the routine-name
 * bar — the whole loc_2745 arm family stays loc_ for the same reason. Promote
 * once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-271e.test.js.
 * GATE:     crafted-entry. 0x271E is NEVER dispatched in attract (0 over 6000
 *           frames — it rides sub_26fa's 0x197A gameplay cascade the 25m demo
 *           never drives), so crafted entries on a real booted attract base carry
 *           the gate: an EXHAUSTIVE MARIO_X sweep (all 256 band boundaries)
 *           crossed with a MARIO_Y set that drives both sub-arms of each mover,
 *           plus the two guard early-outs. The RAM diff excludes the dead
 *           STACK_SCRATCH the oracle's push16(0x2721)/ret bracket churns; every
 *           live work-RAM cell is kept. Teeth: a twin that drops the delegation
 *           and a twin that delegates to the wrong arm.
 * LIVE-OUT: memory-only — whatever loc_2745's dispatched arm writes. This routine
 *           reads and writes nothing itself; the caller (sub_26fa's discarded
 *           tail) consumes no register/flag, and the terminal return is dead ABI.
 *           The equivalence test still lines pc + SP up to prove the dissolved
 *           call/return bracket matches.
 * NAMES:    none of its own — every cell is loc_2745's. loc_2745 (ROM 0x2745) is
 *           direct-called with no register inputs.
 */

import { loc_2745 } from "./loc_2745.js"; // ROM 0x2745 — the vertical-reposition machine

/**
 * @param {object} m  the machine (delegates entirely to loc_2745).
 * @returns {void}
 */
export function loc_271e(m) {
  // The routine's entire body: run the reposition machine and return. The oracle
  // brackets this as a call/return pair; here it is a plain delegation.
  loc_2745(m);
}
