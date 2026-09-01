// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of
// truth; this file gives the idiomatic layer symbols for work-RAM cells (imported by modules) plus the
// ROUTINES map that dispatches idiomatic rewrites over the translated fallback (resolveAllIdiomatic).
// Tags: [seen] MAME-confirmed, [code] read from the translated behaviour, [guess] role unknown.

// Return-stack scratch (SP inits 0x2400, grows down; measured deepest 0x23e0 over attract+play). The
// equivalence RAM diff excludes this span.
export const STACK_SCRATCH = { lo: 0x23e0, hi: 0x2400 };

// Work-RAM cells -- loc_ placeholders (role pending the understand half; allowlisted in names-debt.txt).
export const loc_20c1 = 0x20c1;

export const ROUTINES = {
  0x1982: { name: "loc_1982", role: "store A -> loc_20c1", cert: "code" },
};
