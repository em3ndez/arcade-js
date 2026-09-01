// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2010, loc_2011, loc_2015, loc_201d, loc_2025, loc_202d, loc_20ed, loc_20ef } from "./names.js";
import { readActivePlayerInput } from "./readActivePlayerInput.js";

// Pre-round advance gate: only once the round is armed and the field is idle, either step the marching
// pointer, clear a stale fire-latch, or arm the round from a fresh fire press.
export function loc_1618(m) {
  if (m.mem8[loc_2015] !== 0xff) return;
  if (m.mem8[loc_2010] !== 0 || m.mem8[loc_2011] !== 0) return;
  if (m.mem8[loc_2025] !== 0) return;

  if (m.mem8[loc_20ef] === 0) {
    m.mem8[loc_2025] = 0x01;
    let ptr = u16(m.mem16[loc_20ed] + 1);
    const lo = ptr & 0xff;
    if (lo >= 0x7e) ptr = ptr - lo + 0x74; // wrap the low byte back to the start of the march window
    m.mem16[loc_20ed] = ptr;
    m.mem8[loc_201d] = m.mem8[ptr];
    return;
  }

  if (m.mem8[loc_202d] !== 0) {
    const fire = readActivePlayerInput(m) & 0x10;
    if (fire !== 0) return;
    m.mem8[loc_202d] = fire;
    return;
  }

  if ((readActivePlayerInput(m) & 0x10) === 0) return;
  m.mem8[loc_2025] = 0x01;
  m.mem8[loc_202d] = 0x01;
}
