// SPDX-License-Identifier: GPL-3.0-only
//
// Dissolve invariant (mechanical guard): NO idiomatic routine may m.call() an address
// that is ALREADY decompiled in idiomatic/. Such a call is a register-marshalling leak
// the equivalence gate cannot see -- a stale m.call and a direct call are memory-
// equivalent, so per-routine review + the gate both pass it. Only this CROSS-FILE lint
// catches it: a reviewer of routine A does not know callee B got decompiled in a
// different batch. It is the "don't trust memory" backstop for the rule that the
// idiomatic layer reaches ZERO m.call to decompiled callees (DK parity).
//
// A callee with no idiomatic file yet is a genuine oracle boundary and stays m.call --
// this lint only flags calls to callees that HAVE been decompiled.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const IDIR = join(dirname(fileURLToPath(import.meta.url)), "..");

// ALLOWLIST — intentional never-returning forever-loop m.call BOUNDARIES.
//
// A handful of decompiled callees never return: they re-seat the stack and spin forever
// (the main loop 0x0348, the round init 0x031a which falls into it, the reset/entry handler
// 0x01f9 which re-enters play, and the credit-screen hold 0x021c which displays forever).
// Dissolving the tail-calls into these to DIRECT idiomatic calls makes the caller's
// equivalence test spin forever — the forever loop can no longer be intercepted by a
// registry stub, and a direct call is memory-equivalent to the m.call anyway. So these tails
// are deliberately KEPT as m.call boundaries: the equivalence harness stubs (or watchdog-
// bounds) the target address through the registry, which only works when the call goes
// through m.call. Each is documented at its call site with an "m.call boundary:" comment.
//
// Keyed `<caller-file>` -> Set of allowed target addresses (numbers). Anything NOT listed
// here that m.call()s a decompiled callee is still a genuine stale-call leak.
const FOREVER_LOOP_BOUNDARIES = new Map([
  ["loc_031a.js", new Set([0x0348])], // -> mainLoop
  ["enterPlayMode.js", new Set([0x031a])], // -> round init (falls into mainLoop)
  ["advanceToNextLevel.js", new Set([0x031a])], // -> round init (falls into mainLoop)
  ["loc_02ca.js", new Set([0x031a])], // -> round init (falls into mainLoop)
  ["loc_02e1.js", new Set([0x031a])], // -> round init (falls into mainLoop)
  ["loc_03ac.js", new Set([0x01f9])], // -> reset/entry handler (re-enters play, forever)
  ["submitHighScoresAndReset.js", new Set([0x01f9])], // -> reset/entry handler (forever)
  ["loc_01f9.js", new Set([0x021c])], // -> credit-screen hold (displays forever)
]);

test("no idiomatic routine m.call()s an already-decompiled callee (dissolve invariant)", () => {
  const files = readdirSync(IDIR).filter((f) => f.endsWith(".js") && f !== "ram.js");
  // A routine is "decompiled" IFF it has an equivalence-<addr>.test.js -- the one
  // unambiguous signal. Scanning source for "ROM 0x...." false-positives on a prose
  // mention of an oracle-boundary callee (e.g. a comment "kept m.call(0x3dea)"), which
  // would wrongly demand dissolving a call to a routine that has no idiomatic file.
  const decompiled = new Set();
  for (const t of readdirSync(join(IDIR, "test"))) {
    const m = t.match(/^equivalence-([0-9a-f]{4})\.test\.js$/);
    if (m) decompiled.add(parseInt(m[1], 16));
  }
  const leaks = [];
  for (const f of files) {
    const src = readFileSync(join(IDIR, f), "utf8");
    for (const m of src.matchAll(/m\.call\(\s*0x([0-9a-f]{2,4})/g)) {
      const addr = parseInt(m[1], 16);
      if (!decompiled.has(addr)) continue;
      // Skip documented never-returning forever-loop boundaries (see FOREVER_LOOP_BOUNDARIES).
      if (FOREVER_LOOP_BOUNDARIES.get(f)?.has(addr)) continue;
      leaks.push(`${f} -> 0x${addr.toString(16)} (decompiled: equivalence-${addr.toString(16)}.test.js exists)`);
    }
  }
  assert.equal(
    leaks.length,
    0,
    `${leaks.length} stale m.call(s) to already-decompiled callees -- dissolve them to direct idiomatic calls:\n  ${leaks.join("\n  ")}`,
  );
});
