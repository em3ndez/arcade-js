// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0efd — command 0x08: append the fixed byte 0x08 into the page-0x8a command ring.
 * A thin front that fixes the byte and delegates to the ring appender, whose own
 * game-active / play-mode gates decide whether the byte lands.
 * LIVE-OUT: A = the appender's advanced ring cursor (0 on the gates-closed path); it survives
 * in A because the AF pair is not restored across the tail, and callers read it. Set via the
 * return-assignment bridge.
 */

const COMMAND_BYTE = 0x08;

export function loc_0efd(m) {
  return (m.regs.a = loc_0ea2(m, COMMAND_BYTE)); // A live-out: the advanced cursor from the appender
}
