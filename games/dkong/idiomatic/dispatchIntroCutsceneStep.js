// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchIntroCutsceneStep — vector the opening Kong-climb cutscene to its current step handler,
 * read from an 8-entry inline jump table of little-endian target addresses.
 *
 * LIVE-OUT: memory-only — the step handler's writes.
 */

import { INTRO_STEP } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

const INTRO_STEP_TABLE = 0x0a7a;
const DISPATCH_TABLE_0A7A = "0x0A7A (0x6385 sequence)";

export function dispatchIntroCutsceneStep(m) {
  const { mem8 } = m;

  const step = mem8[INTRO_STEP];

  // Doubling into the table offset is an 8-bit result: base + (2*step & 0xff), not base + 2*step.
  const entry = (INTRO_STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem8[entry] | (mem8[(entry + 1) & 0xffff] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_0A7A);
}
