// SPDX-License-Identifier: GPL-3.0-only
/**
 * insertHighScoreEntry — memory + A equivalent to the frozen oracle at ROM 0x0A84.
 * GATE: crafted-entry. Attract never dispatches this sorted-table insert, so a post-boot machine is
 * cloned, its five-entry table poked to a descending order, and D/E poked to the key (this leaf takes
 * the key in D/E and walks its own table in RAM). LIVE-OUT is memory + register A: the caller consumes
 * A (so A is compared; DE/HL/flags are reloaded, so not). The oracle's push/pop leaves dead scratch in
 * [SP-8, SP) the register-free rewrite never writes, excluded from the RAM diff. Teeth: three twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { insertHighScoreEntry } from "../insertHighScoreEntry.js";
import { loc_0a84 as oracle } from "../../translated/loc_0a84.js";

const TABLE_TOP_HI = 0x83f2; // key-high of the first (highest-address-walked) slot
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

// A post-boot machine with a known descending table and the key (D,E) poked in.
function craft(dHi, eLo) {
  const m = seedMachine().clone();
  const highs = [50, 40, 30, 20, 10];
  for (let k = 0; k < 5; k++) {
    m.mem8[(TABLE_TOP_HI + 2 * k) & 0xffff] = highs[k]; // key-high
    m.mem8[(TABLE_TOP_HI - 1 + 2 * k) & 0xffff] = 0; // key-low
  }
  m.regs.d = dHi; m.regs.e = eLo;
  return m;
}

// null == equivalent on the declared live-out: RAM (minus the dead [SP-8,SP) stack scratch the
// oracle's push/pop leaves) plus register A.
function unitDiff(cand, machine) {
  const sp0 = machine.regs.sp;
  const lo = (sp0 - 8) & 0xffff, hi = sp0;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `RAM 0x${addr.toString(16)}: ${da[i]} vs ${db[i]}`;
  }
  if (a.regs.a !== b.regs.a) return `A ${a.regs.a} vs ${b.regs.a}`;
  return null;
}

// [name, D, E, expected A] — insert with shift, tie-break insert, no-insert, dup-at-top, last slot.
const CASES = [
  ["insert slot 0 (full shift)", 55, 0, 17],
  ["insert slot 1 (shift)", 45, 0, 13],
  ["insert slot 2 (tie high, higher low)", 30, 1, 9],
  ["insert last slot", 15, 0, 1],
  ["no insert (ranks below all)", 5, 0, 0],
  ["exact dup at top slot (not stored)", 10, 0, 1],
  ["mid-slot exact match inserts below (not rejected)", 30, 0, 5],
];

// broken twins.
function brokenNoOp() {}
function brokenNoShift(m) {
  const { regs, mem8 } = m; // BUG: stores at the slot but never shifts the tail down
  mem8[0x83f4] = regs.d; mem8[0x83f3] = regs.e; regs.a = 13;
}
function brokenWrongA(m) { insertHighScoreEntry(m); m.regs.a = (m.regs.a + 1) & 0xff; } // correct RAM, wrong A

test("EQUAL (crafted): insertHighScoreEntry == oracle on RAM + A for every insert path", { skip }, () => {
  assert.ok(CASES.length > 0, "vacuous: no crafted entries");
  for (const [name, d, e, expA] of CASES) {
    const entry = craft(d, e);
    assert.equal(unitDiff(insertHighScoreEntry, entry), null, `diverged: ${name}`);
    const chk = entry.clone(); oracle(chk);
    assert.equal(chk.regs.a, expA, `oracle A mismatch on ${name}`); // pin the encoding
  }
  assert.ok(unitDiff(brokenNoOp, craft(45, 0)), "vacuous: oracle changed nothing");
  console.log(`  EQUAL: ${CASES.length} crafted insert paths, insertHighScoreEntry == oracle (RAM + A)`);
});

test("TEETH: broken twins are caught across memory, shift, and the A arm", { skip }, () => {
  const e = craft(45, 0); // inserts at slot 1 with a real tail shift
  assert.ok(unitDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(unitDiff(brokenNoShift, e), "the no-shift twin escaped");
  assert.ok(unitDiff(brokenWrongA, e), "the wrong-A twin escaped");
  console.log("  TEETH: no-op, no-shift, wrong-A all caught");
});
