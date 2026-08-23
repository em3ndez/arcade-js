// SPDX-License-Identifier: GPL-3.0-only
import { loc_20d4 } from "./loc_20d4.js";
import { loc_72a7 } from "./loc_72a7.js";
/**
 * loc_72a0 — bonus phase 1 body: run the shared per-frame update, then the wave-launch driver.
 *
 * LIVE-OUT: memory only — the phase dispatcher that calls this reads no register back; the wave
 * driver's own result is forwarded straight through as a faithful tail hand-off.
 */

export function loc_72a0(m) {
  loc_20d4(m); //      shared per-frame update
  return loc_72a7(m); // wave-launch driver
}
