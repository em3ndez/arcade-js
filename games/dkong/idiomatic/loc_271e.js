// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_271e — thin wrapper: run the vertical-reposition machine, then return.
 *
 * The whole routine is a single delegation. It reads and writes nothing of its own; it hands
 * control to the vertical-reposition machine — which gates on the reposition flag and
 * Mario's grounded state, then dispatches on Mario's X into one of two vertical mover arms
 * or a third arm — and returns whatever that leaves behind.
 *
 * It is one of the two bodies the 75m board service picks between, and the SELECTION is that
 * service's level/frame cadence, NOT its position test: the Mario-Y compare higher up routes
 * only to the kill path. On the level-1 cadence this body is jumped to; on the faster cadence
 * it is simply fallen into.
 *
 * NOT CLAIMED: which game event drives this reposition, and what taking the machine's THIRD
 * arm means — that arm has never been observed executing.
 *
 * LIVE-OUT: memory-only — whatever the dispatched mover arm writes. This routine reads and
 * writes nothing itself, and whoever reaches it consumes no value.
 */

import { dispatchElevatorRideByColumn } from "./dispatchElevatorRideByColumn.js";

/**
 * @param {object} m  the machine (delegates entirely to the vertical-reposition machine).
 * @returns {void}
 */
export function loc_271e(m) {
  // The routine's entire body: run the reposition machine and return.
  dispatchElevatorRideByColumn(m);
}
