// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f11 — enqueue the fixed command byte into the command ring.
 * Hands the constant byte 0x0c to the ring-append helper and tail-returns its result, so the
 * append and its game-active / play-mode gate live entirely in the helper.
 * LIVE-OUT: A — the helper leaves the advanced ring cursor in A (0 when the gate is closed) and
 * it rides the tail return out to the caller, which reads it straight from the register.
 */
const COMMAND_BYTE = 0x0c; // the fixed byte this trigger enqueues

export function loc_0f11(m) {
  return loc_0ea2(m, COMMAND_BYTE);
}
