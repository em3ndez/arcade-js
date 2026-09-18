// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_271e — thin wrapper: run the vertical-reposition machine, then return. It reads and writes
 * nothing of its own and hands back whatever the machine leaves.
 * It is one of the two bodies the 75m board service picks between; the SELECTION is that service's
 * level/frame cadence, not a position test. NOT CLAIMED: which event drives the reposition.
 */

import { dispatchElevatorRideByColumn } from "./dispatchElevatorRideByColumn.js";

export function loc_271e(m) {
  dispatchElevatorRideByColumn(m);
}
