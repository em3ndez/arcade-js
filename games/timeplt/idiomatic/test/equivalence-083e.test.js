// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_083e — memory-equivalent to the frozen oracle at ROM 0x083E.
 * GATE: real dispatch (coin-start and attract both reach this title arm) plus a strip-dirtied craft;
 *   RAM diffed with the dead stack scratch below the seat masked, the +2 SP re-seat asserted, regs
 *   not compared (the dissolved tail pops a return the rewrite drops). The fail branch is unreachable
 *   -- read-only ROM pins the fold to the match -- so its landing dissolve is caught by the
 *   branch-swap twin instead. Run: node --test games/timeplt/idiomatic/test/equivalence-083e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_083e as candidate } from "../loc_083e.js";
import { loc_083e as oracle } from "../../translated/loc_083e.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { postCommand } from "../postCommand.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { loc_08fa } from "../loc_08fa.js";
import { u8 } from "../../../../core/int.js";
import { SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x083e;
const CAPTION_COMMAND = 1;
const CAPTION_ARGUMENTS = [0, 1, 3, 4, 5, 6, 7, 20, 21];
const CHECKSUM_BLOCK = 0x176a;
const CHECKSUM_LENGTH = 24;
const CHECKSUM_MATCH = 0xc9;
const STRIP_CELLS = [0xaa10, 0xaa11, 0xaa12, 0xaa13, 0xaa14, 0xaa15, 0xaa16, 0xaa17];
const DATA_TOP = 0xadff;
const CORPUS_FRAMES = 2000;
const COINSTART_DISPATCHES = 1;
const ATTRACT_DISPATCHES = 1;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

function run(fn, m) {
  try { fn(m); return "returned"; } catch (e) { return e.name || "threw"; }
}

/**
 * Oracle vs candidate on independent clones. The oracle's tail transfer pops the caller's return
 * and its nested calls leave dead words below the seat, neither of which the rewrite writes, so the
 * diff excludes [low, seat) with low measured off the oracle's own pushes; a throw must match kind.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const kindOracle = run(oracle, a);
  const kindCand = run(cand, b);
  if (kindOracle !== kindCand) return { escaped: { addr: null }, low, seat, spDiff: 0, kindOracle, kindCand };
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, kindOracle, kindCand };
}

/** Game-data cells the oracle moves from a state, stack scratch ignored. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  run(oracle, a);
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(addr);
  }
  return cells;
}

let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

function craft(mutate) {
  const m = entryState().clone();
  mutate(m);
  return m;
}

function scenarios() {
  return [
    ["captured", craft(() => {})],
    ["dirtyStrip", craft((m) => { for (const a of STRIP_CELLS) m.mem8[a] = 0x5a; })],
  ];
}

/** The rewrite with one deliberate defect each; every knob matches loc_083e by default. */
function twin({ flash = true, stamp = true, args = CAPTION_ARGUMENTS, swap = false } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    if (flash) flashCopyrightLine(m);
    if (stamp) stampCopyrightStrip(m);
    for (const a of args) postCommand(m, CAPTION_COMMAND, a);
    let fold = 0;
    let low = CHECKSUM_BLOCK & 0xff;
    const page = CHECKSUM_BLOCK & 0xff00;
    for (let i = 0; i < CHECKSUM_LENGTH; i++) { fold ^= mem8[page + low]; low = u8(low + 1); }
    regs.a = fold;
    regs.sub(CHECKSUM_MATCH);
    if (swap) return regs.fNZ ? advanceSequenceSubStep(m) : loc_08fa(m);
    return regs.fNZ ? loc_08fa(m) : advanceSequenceSubStep(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 2],
  ["skip-flash", twin({ flash: false }), 2],
  ["skip-stamp", twin({ stamp: false }), 1],
  ["wrong-args", twin({ args: [0, 1, 3, 4, 5, 6, 7, 20, 22] }), 2],
  ["invert-checksum-branch", twin({ swap: true }), 2],
];

test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  assert.equal(r.spDiff, 2, "the oracle pops a return address and the rewrite does not");
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("LIVE-OUT: the pass path steps the sequence sub-step, and the comparison is not vacuous", { skip }, () => {
  const a = entryState().clone();
  const before = a.mem8[SEQUENCE_SUBSTEP];
  run(oracle, a);
  assert.equal(a.mem8[SEQUENCE_SUBSTEP], u8(before + 1), "the pass path did not step the sub-step");
  const cells = footprint(entryState());
  assert.ok(cells.length > 0, "the routine moves no game data, so EQUAL would pass a do-nothing rewrite");
  console.log(`  LIVE-OUT: sub-step ${before} -> ${a.mem8[SEQUENCE_SUBSTEP]}, ${cells.length} data cells moved`);
});

test("PATHS and SP: both scenarios are equivalent and re-seat two bytes higher", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops a return the rewrite does not`);
  }
  // ★ dirtyStrip must actually differ from captured, or skip-stamp's teeth are hollow.
  const dirty = footprint(scenarios()[1][1]);
  assert.ok(dirty.some((a) => STRIP_CELLS.includes(a)), "dirtying the strip changed nothing the stamp rewrites");
  console.log(`  PATHS: 2 scenarios equivalent, spDiff +2; dirtyStrip restamps the strip`);
});

test("CORPUS: every dispatch replays identically under both tapes", { skip }, () => {
  const drive = (opts) => {
    let dispatched = 0;
    let caught = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (compare(candidate, mm).escaped) caught++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, caught };
  };
  const coin = drive({});
  const attract = drive({ tape: [] });
  assert.equal(coin.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, ATTRACT_DISPATCHES, "the attract dispatch count moved");
  assert.equal(coin.caught, 0, `the rewrite diverged on ${coin.caught} coin-start dispatches`);
  assert.equal(attract.caught, 0, `the rewrite diverged on ${attract.caught} attract dispatches`);
  // ★ Positive control: both counts are non-zero, so a zero above would be a regression, not a blind tap.
  assert.ok(coin.dispatched > 0 && attract.dispatched > 0, "the routine is no longer reached; the corpus is blind");
  console.log(`  CORPUS: coin-start ${coin.dispatched}, attract ${attract.dispatched}, all identical`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(brokenTwin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}
