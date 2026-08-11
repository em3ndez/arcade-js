// SPDX-License-Identifier: GPL-3.0-only
/** seedDemoAutopilotScript — seed the attract-demo autopilot: pick a heading-command script by the demo selector,
 * seat its dwell counter and little-endian pointer, then gate on the tamper readback. LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { loc_2251 } from "./loc_2251.js";
import { DEMO_SCRIPT_DWELL, DEMO_SCRIPT_POINTER_HI, DEMO_SCRIPT_POINTER_LO, PLAYER_ONE_ERA_INDEX, TAMPER_COLOUR_READBACK, TAMPER_GLYPH_READBACK } from "./names.js";

export function seedDemoAutopilotScript(m) {
  const { regs, mem8 } = m;

  const selector = mem8[PLAYER_ONE_ERA_INDEX];
  const script =
    selector === 0 || selector === 3 ? 0x218c
    : selector === 1 ? 0x2251
    : 0x22fa;

  mem8[DEMO_SCRIPT_DWELL] = u8(mem8[script] + 1); // dwell counter, one past the script's leading byte
  mem8[DEMO_SCRIPT_POINTER_LO] = script & 0xff;
  mem8[DEMO_SCRIPT_POINTER_HI] = script >> 8;

  // a genuine tile image returns; a failed readback drops into the trap, carrying the cursor it read
  regs.de = script;
  if (mem8[TAMPER_GLYPH_READBACK] !== 0xfd) { regs.hl = TAMPER_GLYPH_READBACK; return loc_2251(m); }
  if (mem8[TAMPER_COLOUR_READBACK] === 0x10 || mem8[TAMPER_COLOUR_READBACK] === 0x05) return;
  regs.hl = TAMPER_COLOUR_READBACK;
  return loc_2251(m);
}
