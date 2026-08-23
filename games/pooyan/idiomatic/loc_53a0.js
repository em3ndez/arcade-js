// SPDX-License-Identifier: GPL-3.0-only
import { loc_5733 } from "./loc_5733.js";
/**
 * loc_53a0 — spawn-one-actor entry wrapper.
 *
 * Seeds the spawn body's column entry with 0xff, then runs the body on the record IX with kind byte
 * E (both forwarded; they default to the register bridge for a register-dispatched caller). The body
 * always unwinds past this wrapper, so the wrapper contributes only the seed and has no epilogue.
 *
 * LIVE-OUT: memory only — the spawn body's record writes; nothing survives here.
 */
const SEED = 0xff; // entry-column seed handed to the spawn body

export function loc_53a0(m, ix = m.regs.ix, e = m.regs.e) {
  loc_5733(m, SEED, ix, e);
}
