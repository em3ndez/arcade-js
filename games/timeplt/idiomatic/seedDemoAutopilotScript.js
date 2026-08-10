// SPDX-License-Identifier: GPL-3.0-only
/** seedDemoAutopilotScript — seed the attract-demo autopilot: pick a heading-command script by the demo selector,
 * seat its dwell counter and little-endian pointer, then gate on the tamper readback. LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { loc_2251 } from "./loc_2251.js";

export function seedDemoAutopilotScript(m) {
  const { regs, mem8 } = m;

  const selector = mem8[0xad14];
  const script =
    selector === 0 || selector === 3 ? 0x218c
    : selector === 1 ? 0x2251
    : 0x22fa;

  mem8[0xadf2] = u8(mem8[script] + 1); // dwell counter, one past the script's leading byte
  mem8[0xadf3] = script & 0xff;
  mem8[0xadf4] = script >> 8;

  // a genuine tile image returns; a failed readback drops into the trap, carrying the cursor it read
  regs.de = script;
  if (mem8[0xadfb] !== 0xfd) { regs.hl = 0xadfb; return loc_2251(m); }
  if (mem8[0xadfc] === 0x10 || mem8[0xadfc] === 0x05) return;
  regs.hl = 0xadfc;
  return loc_2251(m);
}
