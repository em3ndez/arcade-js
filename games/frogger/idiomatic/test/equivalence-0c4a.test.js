// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c4a — memory-equivalent to the frozen oracle at ROM 0x0C4A.
 * GATE: crafted-entry. Attract never dispatches this intro-digit stamper (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and its D/C/E/H registers poked to drive
 * each path — a normal row, the 8-bit wrap when D<C, and the C==0 no-write skip. The target cell is
 * pre-cleared so the stamp is observable. Live-out is memory-only (loc_0bb3 overwrites HL right after
 * the call; A/L are dead), so registers/SP are not compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0c4a } from "../loc_0c4a.js";
import { loc_0c4a as oracle } from "../../translated/loc_0c4a.js";
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

// A post-boot machine with the register ABI poked as the caller supplies it (page in H, row base in
// D, offset in C, tile in E), the target pre-cleared so the oracle's stamp is observable.
function entry(h, d, c, e) {
  const m = seedMachine().clone();
  m.regs.h = h; m.regs.d = d; m.regs.c = c; m.regs.e = e;
  m.mem8[(h << 8) | ((d - c) & 0xff)] = 0;
  return m;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// [h, d, c, e]: normal, min offset, deeper row, D<C 8-bit wrap, C==0 skip (no write).
const CASES = [[0x80, 0x30, 5, 0x04], [0x80, 0x30, 1, 0x77], [0x80, 0x30, 9, 0x2a], [0x80, 0x03, 0x09, 0x11], [0x80, 0x40, 0, 0x55]];

function brokenNoOp() {}
function brokenWrongTile(m) {
  const { regs, mem8 } = m;
  if (regs.c === 0) return;
  mem8[(regs.h << 8) | ((regs.d - regs.c) & 0xff)] = regs.e ^ 0xff;
}
function brokenNoSkip(m) { // ignores the C==0 skip -> writes where the oracle does not
  const { regs, mem8 } = m;
  mem8[(regs.h << 8) | ((regs.d - regs.c) & 0xff)] = regs.e;
}

test("EQUAL (crafted): loc_0c4a == oracle on every register path", { skip }, () => {
  const entries = CASES.map((c) => entry(...c));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_0c4a, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(0x80, 0x30, 5, 0x04)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted register paths, loc_0c4a == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const writing = entry(0x80, 0x30, 5, 0x04);
  const skipping = entry(0x80, 0x40, 0, 0x55);
  assert.ok(ramDiff(brokenNoOp, writing), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, writing), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenNoSkip, skipping), "the no-skip twin escaped");
  console.log("  TEETH: no-op, wrong-tile, no-skip all caught");
});
