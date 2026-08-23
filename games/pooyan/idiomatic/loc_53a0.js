// SPDX-License-Identifier: GPL-3.0-only
import { loc_5733 } from "./loc_5733.js";
/**
 * loc_53a0 — spawn-one-actor entry wrapper.
 *
 * Seeds the spawn body's entry register with 0xff, then runs the body. The body always unwinds
 * past this wrapper — its caller-skip return lands directly in this wrapper's own caller — so the
 * wrapper contributes only the seed and has no reachable epilogue of its own.
 *
 * LIVE-OUT: memory only — the spawn body's record writes; nothing survives here.
 */
const SEED = 0xff; // entry-register seed handed to the spawn body

export function loc_53a0(m) {
  loc_5733(m, SEED);
}
