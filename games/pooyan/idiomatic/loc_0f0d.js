// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f0d — append the fixed command byte 0x0b into the page-0x8a command ring. A one-line
 * wrapper: it selects byte 0x0b and hands it to the ring-append helper.
 *
 * LIVE-OUT: A = the advanced ring cursor the helper leaves in the accumulator (0 on the
 * gates-closed path); callers read it, propagated via the helper's return-assignment.
 */

const COMMAND_BYTE = 0x0b; // the command byte this wrapper appends

export function loc_0f0d(m) {
  return loc_0ea2(m, COMMAND_BYTE);
}
