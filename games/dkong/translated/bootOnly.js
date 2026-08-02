// SPDX-License-Identifier: GPL-3.0-only
import { loc_0266 } from "./loc_0266.js";

/**
 * bootOnly  (ROM 0x0000–0x02BC) — reset through the end of boot, stopping before the fall-through into the main loop.
 *
 * Not a ROM boundary -- the hardware just keeps going. It exists because
 * `reset()` faithfully never returns, so tests and diagnostics that want
 * "the machine as boot left it" need somewhere to stop.
 */
export function bootOnly(m) {
  const { regs } = m;
  regs.a = 0x00;
  m.tick(7); // ld a,0x00
  m.mem.write8(0x7d84, regs.a, 10); // ld (nn),a
  m.tick(13); // ld (0x7d84),a
  m.tick(10); // jp 0x0266
  loc_0266(m);
}
