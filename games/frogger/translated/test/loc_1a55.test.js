// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1a55 (Frogger master collision/scoring orchestrator, ROM 0x1A55-0x1ACA). When
// (0x83FE)==0 it skips straight to the 0x1a8f tail; otherwise it calls the per-frame sub-engines, runs
// the interior (0x8340) timing helper at 0x1a9f, a (0x83b7).bit0 scroll-timer branch (interior 0x1aad),
// then tails to loc_1cff ((0x8047)<0x31) or loc_1acb. Sub-engines are SP-balanced CALL stubs; loc_1cff
// and loc_1acb are no-op tail-jump stubs.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1a55 } from "../loc_1a55.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // stubbed CALL returns
const noop = () => {}; // stubbed tail-jump target

function mk() {
  const routines = new Map([
    [0x28bb, bal], [0x291d, bal], [0x27ea, bal], [0x26a6, bal], [0x2906, bal],
    [0x23eb, bal], [0x23fa, bal], [0x25ce, bal], [0x269a, bal], [0x27de, bal],
    [0x2496, bal], [0x2532, bal],
    [0x1cff, noop], [0x1acb, noop],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_1a55: (0x83fe)==0 skips the engines and tails to loc_1cff when (0x8047)<0x31 (59 T)", () => {
  const m = mk();
  w(m, 0x83fe, 0x00); w(m, 0x8047, 0x20);
  loc_1a55(m);
  assert.deepEqual(m.calls, [0x1cff]);
  assert.equal(m.cycles, 59, "13 + or a 4 + jr z 12 + 13 + cp 7 + jp c 10");
});

// Full active path: engines, interior 0x1a9f (0x8340: 0x02 -> 0x01, hits its 0x269a/0x27de tail),
// interior 0x1aad ((0x8122): 0x00 -> 0x01, no sub-timer), then tail to loc_1acb.
const CALLS_ACTIVE = [0x28bb, 0x291d, 0x27ea, 0x26a6, 0x2906, 0x269a, 0x27de, 0x23eb, 0x1acb];

function mkActive() {
  const m = mk();
  w(m, 0x83fe, 0x01);
  w(m, 0x8340, 0x02); // 0x1a9f: dec -> 0x01 == cp 0x01, so its 0x269a/0x27de tail runs
  w(m, 0x83b7, 0x00);
  w(m, 0x8122, 0x00); // 0x1aad increments; stays below every sub-timer boundary
  w(m, 0x8047, 0x40);
  return m;
}

test("loc_1a55: active frame runs engines + interior helpers, tails to loc_1acb", () => {
  const m = mkActive();
  loc_1a55(m);
  assert.deepEqual(m.calls, CALLS_ACTIVE);
  assert.equal(r(m, 0x8340), 0x01, "(0x8340) decremented by 0x1a9f");
  assert.equal(r(m, 0x8122), 0x01, "(0x8122) incremented by 0x1aad");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1a55.js
//   find: regs.cp(0x01);
//   repl: regs.cp(0x02);
//   expect: FAIL  (0x1a9f's `cp 0x01` gate flips; its 0x269a/0x27de tail is wrongly skipped)
//   verified-anchor: count == 1  (the sole regs.cp(0x01) in loc_1a55.js)
// Simulated by intercepting exactly the cp 0x01, which is what the edit produces.
test("loc_1a55: the contract catches a wrong 0x1a9f gate", () => {
  const m = mkActive();
  const ocp = m.regs.cp.bind(m.regs);
  m.regs.cp = (v) => ocp(v === 0x01 ? 0x02 : v);
  loc_1a55(m);
  assert.throws(() => assert.deepEqual(m.calls, CALLS_ACTIVE));
  assert.deepEqual(
    m.calls,
    [0x28bb, 0x291d, 0x27ea, 0x26a6, 0x2906, 0x23eb, 0x1acb],
    "mutation drops the 0x269a/0x27de tail",
  );
});
