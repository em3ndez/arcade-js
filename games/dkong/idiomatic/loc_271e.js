// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_271e — thin wrapper: run the vertical-reposition machine, then return.
 * ROM 0x271E.
 *
 * The whole routine is a single delegation. It reads and writes nothing of its
 * own; it hands control to dispatchElevatorRideByColumn — which gates on the reposition flag and
 * Mario's grounded state, then dispatches by Mario's X into the two vertical mover
 * arms or the third arm, loc_2766 (never observed executing, so no claim is made about
 * what taking it means) — and returns whatever that leaves behind.
 *
 * It is one of the two bodies service75mBoard selects, and the SELECTION is service75mBoard's level/frame
 * cadence at ROM 0x2705-0x271B, not its position test: the MARIO_Y compare at ROM 0x2700
 * routes only to the kill at ROM 0x277F. On the level-1 cadence this body is reached by
 * `jp z,0x271e` at ROM 0x2713; on the faster cadence by falling through 0x271B.
 *
 * NAME: kept the neutral loc_. The delegation is exact against the oracle, but
 * which game event drives this reposition is not confirmed to the routine-name
 * bar. Its callee dispatchElevatorRideByColumn (ROM 0x2745) WAS promoted in this
 * pass; this one-line wrapper adds nothing of its own to name, so it stays loc_.
 * Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-271e.test.js.
 * GATE:     crafted-entry. 0x271E is NEVER dispatched in attract (0 over 6000
 *           frames — it rides service75mBoard's 0x197A gameplay cascade the 25m demo
 *           never drives), so crafted entries on a real booted attract base carry
 *           the gate: an EXHAUSTIVE MARIO_X sweep (all 256 band boundaries)
 *           crossed with a MARIO_Y set that drives both sub-arms of each mover,
 *           plus the two guard early-outs. The RAM diff excludes the dead
 *           STACK_SCRATCH the oracle's push16(0x2721)/ret bracket churns; every
 *           live work-RAM cell is kept. Teeth: a twin that drops the delegation
 *           and a twin that delegates to the wrong arm.
 * LIVE-OUT: memory-only — whatever dispatchElevatorRideByColumn's dispatched arm writes. This routine
 *           reads and writes nothing itself; the caller (service75mBoard's discarded
 *           tail) consumes no register/flag, and the terminal return is dead ABI.
 *           The equivalence test still lines pc + SP up to prove the dissolved
 *           call/return bracket matches.
 * NAMES:    none of its own — every cell is dispatchElevatorRideByColumn's. dispatchElevatorRideByColumn (ROM 0x2745) is
 *           direct-called with no register inputs.
 */

import { dispatchElevatorRideByColumn } from "./dispatchElevatorRideByColumn.js"; // ROM 0x2745 — the vertical-reposition machine

/**
 * @param {object} m  the machine (delegates entirely to dispatchElevatorRideByColumn).
 * @returns {void}
 */
export function loc_271e(m) {
  // The routine's entire body: run the reposition machine and return. The oracle
  // brackets this as a call/return pair; here it is a plain delegation.
  dispatchElevatorRideByColumn(m);
}
