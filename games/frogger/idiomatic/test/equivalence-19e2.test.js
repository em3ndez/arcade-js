// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_19e2 — memory-equivalent to the frozen oracle at ROM 0x19E2.
 * GATE: crafted-entry. Attract never dispatches this VRAM blit (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and HL — the destination base, the
 * routine's one live-in — poked to each real caller base. Live-out is memory-only, so registers/SP
 * are not compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_19e2 } from "../loc_19e2.js";
import { loc_19e2 as oracle } from "../../translated/loc_19e2.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with HL set to a destination base (a valid entry: the caller supplies HL).
function entry(hl) {
  const e = seedMachine().clone();
  e.regs.hl = hl;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const BASES = [0xa850, 0xa85c, 0xaa70, 0xa802]; // the real caller destination bases

function brokenNoOp() {}
function brokenWrongTile(m) {
  const { mem8, regs } = m;
  let p = regs.hl;
  for (let r = 0; r < 14; r++) {
    mem8[p] = 72;
    mem8[(p + 1) & 0xffff] = 99; // BUG: wrong tile
    const lo = (p + 32) & 0xffff;
    mem8[lo] = 74;
    mem8[(lo + 1) & 0xffff] = 75;
    p = (p + 64) & 0xffff;
  }
}
function brokenShortRows(m) {
  const { mem8, regs } = m;
  let p = regs.hl;
  for (let r = 0; r < 13; r++) { // BUG: one row short
    mem8[p] = 72;
    mem8[(p + 1) & 0xffff] = 73;
    const lo = (p + 32) & 0xffff;
    mem8[lo] = 74;
    mem8[(lo + 1) & 0xffff] = 75;
    p = (p + 64) & 0xffff;
  }
}

test("EQUAL (crafted): loc_19e2 == oracle on every destination base", { skip }, () => {
  const entries = BASES.map(entry);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_19e2, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(0xa850)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted destination bases, loc_19e2 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(0xa850);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, e), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenShortRows, e), "the short-rows twin escaped");
  console.log("  TEETH: no-op, wrong-tile, short-rows all caught");
});
