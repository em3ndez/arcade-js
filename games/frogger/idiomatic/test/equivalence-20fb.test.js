// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20fb — memory-equivalent to the frozen oracle at ROM 0x20FB.
 * GATE: crafted-entry. Attract never dispatches this in-play scroll-wrap handler (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and its scroll object's row/column/
 * row-count fields (0x8273+0/+1/+2), the scroll-phase selector (0x8110) and the edge flag (0x8107)
 * are poked to drive every dispatch arm — the two tables and their two shared phases, the flag-set
 * arm, the flag-clear arm both when the flag is set and already clear, the unmatched-phase tail-only
 * path, and the count-0 edges in both address-building loops. The oracle balances nested push/pop,
 * leaving dead scratch in [SP-8, SP); the diff masks that window. Live-out is memory-only. Teeth:
 * five broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_20fb } from "../loc_20fb.js";
import { loc_20fb as oracle } from "../../translated/loc_20fb.js";

const OBJ = 0x8273; // scroll object: +0 row, +1 column, +2 row count
const PHASE = 0x8110;
const FLAG = 0x8107;
const TAIL = 0x811a; // row-count-minus-one mirror, written on every path
const T_2190 = 0x2190, T_2194 = 0x2194, T_2198 = 0x2198; // ROM stamp tables (distinct bytes)
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

// A post-boot machine with the object fields, phase selector and edge flag poked (a valid entry:
// this handler reads all of them from RAM). The tail mirror is pre-set to a sentinel so its write
// is observable.
function entryWith(row, col, rowCount, phase, flag) {
  const e = seedMachine().clone();
  e.mem8[OBJ] = row;
  e.mem8[OBJ + 1] = col;
  e.mem8[OBJ + 2] = rowCount;
  e.mem8[PHASE] = phase;
  e.mem8[FLAG] = flag;
  e.mem8[TAIL] = 0xee;
  return e;
}

// null == RAM-equivalent outside the dead stack-scratch window. Memory-only live-out; the nested
// push/pop the oracle balances leaves [SP-8, SP) scratch, which is masked.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const lo = (sp - 8) & 0xffff;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < sp) continue; // dead stack scratch
    return `0x${addr.toString(16)}: ${da[i]} vs ${db[i]}`;
  }
  return null;
}

// [row, col, rowCount, phase, flag, label]
const CASES = [
  [8, 0, 2, 80, 0, "phase 80 -> table A (column field 0 -> 256 inner run)"],
  [4, 1, 3, 208, 0, "phase 208 -> table A (shared)"],
  [4, 1, 3, 128, 5, "phase 128 -> table B, flag set -> cleared"],
  [4, 1, 3, 176, 0, "phase 176 -> table B (shared), flag already clear"],
  [4, 1, 3, 160, 0, "phase 160 -> table C, flag set to 1"],
  [4, 1, 3, 0, 0, "unmatched phase -> tail only"],
  [0, 0, 1, 80, 0, "row count 1 -> 256 span run"],
];

// broken twins.
function stampInto(m, base, table) {
  const { mem8 } = m;
  let hl = base;
  for (let cp = 0; cp < 2; cp++) {
    let de = table;
    for (let row = 0; row < 2; row++) {
      mem8[hl] = mem8[de]; mem8[(hl + 1) & 0xffff] = mem8[(de + 1) & 0xffff];
      hl = (hl + 32) & 0xffff; de = (de + 2) & 0xffff;
    }
  }
}
function stampBase(m) {
  const { mem8 } = m;
  const rowField = mem8[OBJ], colField = mem8[OBJ + 1], rowCount = mem8[OBJ + 2];
  const step = rowField + ((32 * colField) & 0xff);
  const spans = rowCount === 0 ? 255 : rowCount === 1 ? 256 : rowCount - 1;
  return { base: (step * spans + 0xa808) & 0xffff, rowCount };
}
function brokenNoOp() {}
function brokenWrongTable(m) { // always stamps table A, ignoring the phase's table choice
  const { mem8 } = m;
  const { base, rowCount } = stampBase(m);
  const phase = mem8[PHASE];
  if (phase === 80 || phase === 208) stampInto(m, base, T_2190);
  else if (phase === 128 || phase === 176) { stampInto(m, base, T_2190); if (mem8[FLAG] !== 0) mem8[FLAG] = 0; }
  else if (phase === 160) { stampInto(m, base, T_2190); mem8[FLAG] = 1; }
  mem8[TAIL] = (rowCount - 1) & 0xff;
}
function brokenNoFlag(m) { // stamps the right tables but drops the edge-flag side effects
  const { mem8 } = m;
  const { base, rowCount } = stampBase(m);
  const phase = mem8[PHASE];
  if (phase === 80 || phase === 208) stampInto(m, base, T_2190);
  else if (phase === 128 || phase === 176) stampInto(m, base, T_2194);
  else if (phase === 160) stampInto(m, base, T_2198);
  mem8[TAIL] = (rowCount - 1) & 0xff;
}
function brokenNoTail(m) { // never writes the tail mirror
  const { mem8 } = m;
  const { base } = stampBase(m);
  const phase = mem8[PHASE];
  if (phase === 80 || phase === 208) stampInto(m, base, T_2190);
  else if (phase === 128 || phase === 176) { stampInto(m, base, T_2194); if (mem8[FLAG] !== 0) mem8[FLAG] = 0; }
  else if (phase === 160) { stampInto(m, base, T_2198); mem8[FLAG] = 1; }
}

test("EQUAL (crafted): loc_20fb == oracle on every dispatch arm", { skip }, () => {
  const entries = CASES.map(([r, c, rc, ph, fl]) => entryWith(r, c, rc, ph, fl));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) {
    assert.equal(ramDiff(loc_20fb, entries[i]), null, `crafted entry diverged: ${CASES[i][5]}`);
  }
  // non-vacuous: the no-op twin must diverge (the oracle really stamps VRAM + writes the tail).
  assert.ok(ramDiff(brokenNoOp, entryWith(4, 1, 3, 160, 0)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted arms, loc_20fb == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const setArm = entryWith(4, 1, 3, 160, 0); // table C + flag set
  const clearArm = entryWith(4, 1, 3, 128, 5); // table B + flag clear
  assert.ok(ramDiff(brokenNoOp, setArm), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTable, setArm), "the wrong-table twin escaped");
  assert.ok(ramDiff(brokenNoFlag, setArm), "the no-flag (set) twin escaped");
  assert.ok(ramDiff(brokenNoFlag, clearArm), "the no-flag (clear) twin escaped");
  assert.ok(ramDiff(brokenNoTail, setArm), "the no-tail twin escaped");
  console.log("  TEETH: no-op, wrong-table, no-flag(set), no-flag(clear), no-tail all caught");
});
