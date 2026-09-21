// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f2e — the direction-table-as-code arm at ROM 0x1F2E, dissolved to a throw.
 * The ADDRESS is a live data table (turnShipTowardTargetHeading reads it as DATA); only this ROUTINE,
 * decoding those bytes as CODE, is a dead arm. It is reached as code only through the copyright-glyph
 * tamper divert inside advancePlayerAnimationStrip (0x2010): the divert fires only when the sampled
 * copyright glyph (TAMPER_GLYPH_STRIP != 0xa5) or colour (TAMPER_COLOUR_STRIP outside {0x05,0x10})
 * departs from its genuine value — i.e. only on a tampered image. On a genuine image the divert never
 * fires, so no input tape dispatches 0x1F2E, and the idiomatic rewrite traps ON ENTRY.
 * Unlike a checksum trap, the oracle's own bytes here mostly EARLY-RET rather than fault, so this
 * arm is dead by UNREACHABILITY, not by fault: the gate proves the divert never fires on the real
 * dispatches. It asserts (1) UNREACHABLE — 0x1F2E dispatched zero times, the dispatch site (0x2010)
 * runs as the not-blind control, and on every first-frame dispatch BOTH tamper-sample cells hold
 * their genuine value; and (2) TRAPS ON ENTRY — the rewrite throws NotImplemented. Teeth below: a
 * rewrite that DID NOT throw (the no-op twin) is caught.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_1f2e } from "../loc_1f2e.js";
import { TAMPER_GLYPH_STRIP, TAMPER_COLOUR_STRIP } from "../names.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";

const TARGET = 0x1f2e;
const DISPATCH_SITE = 0x2010; // advancePlayerAnimationStrip: its first-frame branch is the only divert here
const PHASE = 0x00; // record byte holding the animation phase (ix + PHASE)
const FIRST_FRAME = 0xb4; // phases at or above this take the first-frame branch that can divert
const GENUINE_GLYPH = 0xa5; // TAMPER_GLYPH_STRIP on a genuine image; anything else diverts
const GENUINE_COLOURS = [0x05, 0x10]; // TAMPER_COLOUR_STRIP on a genuine image; anything else diverts
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The broken twin: a rewrite that returns instead of throwing. The throw-on-entry assertion catches it.
function brokenNoOp() {}

// ── UNREACHABLE ───────────────────────────────────────────────────────────────────────────────
test("UNREACHABLE: no tape dispatches 0x1f2e, and the tamper divert never fires", { skip }, () => {
  const seen = { [TARGET]: 0, [DISPATCH_SITE]: 0 };
  let firstFrames = 0, glyphDivert = 0, colourDivert = 0;
  const realTarget = TRANSLATED.get(TARGET);
  const realSite = TRANSLATED.get(DISPATCH_SITE);
  const m = makeMachine(new Map([
    [TARGET, (mm) => { seen[TARGET]++; return realTarget(mm); }],
    [DISPATCH_SITE, (mm) => {
      seen[DISPATCH_SITE]++;
      // Inspect the divert guard the way the site does, on the first-frame branch that can divert.
      if (mm.mem8[(mm.regs.ix + PHASE) & 0xffff] >= FIRST_FRAME) {
        firstFrames++;
        if (mm.mem8[TAMPER_GLYPH_STRIP] !== GENUINE_GLYPH) glyphDivert++;
        if (!GENUINE_COLOURS.includes(mm.mem8[TAMPER_COLOUR_STRIP])) colourDivert++;
      }
      return realSite(mm);
    }],
  ]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  // ★ The zero counts only because the same run saw the dispatch site run and reach its first frame.
  assert.ok(seen[DISPATCH_SITE] > 0, "the dispatch site never ran, so the instrument is blind");
  assert.ok(firstFrames > 0, "the dispatch site never reached its first-frame branch, so the guard is untested");
  assert.equal(glyphDivert, 0, "the copyright-glyph sample diverted on a genuine ROM, so 0x1f2e is live");
  assert.equal(colourDivert, 0, "the copyright-colour sample diverted on a genuine ROM, so 0x1f2e is live");
  assert.equal(seen[TARGET], 0, "the direction-table arm 0x1f2e was dispatched on a genuine ROM");
  console.log(`  UNREACHABLE: 0x1f2e entered ${seen[TARGET]}; site 0x2010 ${seen[DISPATCH_SITE]} ` +
    `(${firstFrames} first-frame, glyph-divert ${glyphDivert}, colour-divert ${colourDivert})`);
});

// ── TRAPS ON ENTRY ──────────────────────────────────────────────────────────────────────────────
test("TRAPS: the rewrite throws on entry; the no-op twin is caught", { skip }, () => {
  const m = makeMachine();
  assert.throws(() => loc_1f2e(m.clone()), NotImplemented, "the rewrite did not trap on entry");
  // Teeth: a rewrite that returns instead of throwing escapes the throw-on-entry assertion.
  assert.throws(
    () => assert.throws(() => brokenNoOp(m.clone()), NotImplemented),
    "the no-op twin (no throw on entry) escaped the trap assertion",
  );
  console.log("  TRAPS: 0x1f2e traps on entry; no-op twin caught");
});
