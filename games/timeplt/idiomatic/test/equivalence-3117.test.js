// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3117 — memory-equivalent to the frozen oracle at ROM 0x3117.
 * GATE: unit-capture at the real dispatch plus a crafted guard-fail entry. The seat path leaves
 *   for a still-frozen scenery run that ends on a return the rewrite drops and whose wrappers drop
 *   the register dance, so its RAM is compared with the dead six-byte stack scratch masked, only
 *   the two cursors it leaves standing checked, and the two-byte stack drift asserted; the
 *   guard-fail transfer path leaves for the dissolved 0x3114->0x307F chain, which drops that chain's
 *   tail return and register dance, so it too is held on RAM outside the dead-stack window with the
 *   scrambled register set excluded and the two-byte drift asserted. Corpus over two tapes, and teeth.
 *   Run: node --test games/timeplt/idiomatic/test/equivalence-3117.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_3117 as candidate } from "../loc_3117.js";
import { loc_3117 as oracle } from "../../translated/loc_3117.js";
import { loc_3114 } from "../loc_3114.js";
import { runSceneryForEra } from "../runSceneryForEra.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3117;
const SENTINEL = 0xad39;
const ERA = 0xad04;
const SCRATCH_BYTES = 6;
/** Every game cell either path writes lands at or below here; the scratch floor sits above it. */
const DATA_TOP = 0xadff;
const SEAT_DRIFT = 2;
const TRANSFER_DRIFT = 2;
/** The dissolved 0x307F chain drops its tail return and this scrambled set; live-out is memory. */
const TRANSFER_EXCLUDED = ["f", "b", "c", "d", "e", "h", "l", "sp"];
const CORPUS_FRAMES = 2000;
const DISPATCHES = { coin: 3, attract: 1 };

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "reg" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

// ── the comparisons ─────────────────────────────────────────────────────────────────────────

/**
 * Seat-path compare: RAM outside [sp-SCRATCH, sp) plus the two cursors the run leaves standing.
 * The scratch registers are deliberately not diffed — the dissolved wrappers drop the register
 * dance and no caller of this tail-jump chain consumes one; memory and the cursors are the live-out.
 */
function compare(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  let threw = null;
  try { cand(b); } catch (e) { threw = String(e).slice(0, 40); }
  if (threw) return { escaped: { addr: null, a: "survived", b: threw }, cursor: null, spDiff: null };
  const da = a.dumpState(), db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= sp - SCRATCH_BYTES && addr < sp) continue;
    escaped = { addr, a: da[i], b: db[i] };
  }
  let cursor = null;
  if (a.regs.ix !== b.regs.ix) cursor = { addr: null, a: `ix=${hex4(a.regs.ix)}`, b: `ix=${hex4(b.regs.ix)}` };
  else if (a.regs.iy !== b.regs.iy) cursor = { addr: null, a: `iy=${hex4(a.regs.iy)}`, b: `iy=${hex4(b.regs.iy)}` };
  return { escaped, cursor, spDiff: a.regs.sp - b.regs.sp, floor: sp - SCRATCH_BYTES };
}
const caught = (r) => r.escaped !== null || r.cursor !== null;

/** Transfer-path compare: the guard-fail path leaves for the dissolved 0x307F chain, so RAM is
 * diffed with the dead-stack window [low, seat) masked and the scrambled register set excluded. */
function strictCompare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const sp = a.regs.sp;
  let low = sp;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  cand(b);
  const da = a.dumpState(), db = b.dumpState();
  let ram = null;
  for (let i = 0; i < da.length && ram === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < sp) continue;
    ram = { addr, a: da[i], b: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) {
    if (TRANSFER_EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` }; break; }
  }
  return { ram, reg, spDiff: a.regs.sp - b.regs.sp };
}

// ── the captured entry, and the crafted guard-fail entries ────────────────────────────────

let entry = null;
function seatEntry() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

/** The natural sentinel always passes, so the transfer arm is reached only by poking it. */
function craft(mutate) {
  const m = seatEntry().clone();
  mutate(m);
  return m;
}
const transfers = () => [
  ["byte0", craft((m) => { m.mem8[SENTINEL] = 0x00; })],
  ["byte1", craft((m) => { m.mem8[SENTINEL + 1] = 0x07; })],
];

// ── twins ─────────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; defaults reproduce loc_3117. */
function variant({ shadow = true, tintOff = 0x10, count = 4, stride = 4, transfer = true } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    regs.hl = SENTINEL;
    regs.a = mem8[regs.hl];
    if (regs.a !== 0x68) return loc_3114(m);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = mem8[regs.hl];
    if (regs.a !== 0x10 && regs.a !== 0x05) return loc_3114(m);
    regs.hl = 0x316e;
    regs.iy = 0xaa30;
    regs.b = count;
    do {
      const tint = mem8[regs.hl];
      mem8[(regs.iy + 0x31) & 0xffff] = tint;
      if (shadow) mem8[(regs.iy + 0x33) & 0xffff] = (tint + tintOff) & 0xff;
      const shape = mem8[(regs.hl + 1) & 0xffff];
      mem8[regs.iy & 0xffff] = shape;
      mem8[(regs.iy + 2) & 0xffff] = shape;
      regs.hl = (regs.hl + 2) & 0xffff;
      regs.iy = (regs.iy + stride) & 0xffff;
      regs.b = (regs.b - 1) & 0xff;
    } while (regs.b !== 0);
    if (transfer) return runSceneryForEra(m);
  };
}

/** Scrambles a cursor the run leaves standing; the control that the cursor check has teeth. */
function brokenMovesCursor(m) {
  candidate(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", () => {}],
  ["skip-shadow", variant({ shadow: false })],
  ["wrong-tint", variant({ tintOff: 0x11 })],
  ["one-object-short", variant({ count: 3 })],
  ["wrong-stride", variant({ stride: 5 })],
  ["no-transfer", variant({ transfer: false })],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the six-byte scratch window", { skip }, () => {
  assert.notEqual(seatEntry(), null, "vacuous: the tape never reached the routine");
  const r = compare(candidate, seatEntry());
  assert.equal(r.escaped, null, `a divergence escaped the scratch window — ${show(r.escaped)}`);
  assert.equal(r.cursor, null, `a cursor diverged — ${show(r.cursor)}`);
  assert.equal(r.spDiff, SEAT_DRIFT, "the dropped scenery-run return no longer moves the pointer");
  // ★ The mask is safe only because its floor sits above every game cell either path writes.
  assert.ok(r.floor > DATA_TOP, `the scratch floor ${hex4(r.floor)} reached into game data`);
  console.log(`  EQUAL: era=${hex4(seatEntry().mem8[ERA])} sp=${hex4(seatEntry().regs.sp)} spDiff ${r.spDiff}`);
});

test("TRANSFER PATH (crafted): guard-fail is byte-exact on RAM and every register", { skip }, () => {
  for (const [label, m] of transfers()) {
    const r = strictCompare(candidate, m);
    assert.equal(r.ram, null, `${label}: RAM diverged — ${show(r.ram)}`);
    assert.equal(r.reg, null, `${label}: a register diverged — ${show(r.reg)}`);
    assert.equal(r.spDiff, TRANSFER_DRIFT, `${label}: the dropped chain return no longer drifts by two`);
  }
  // Not vacuous: the poked entry really leaves down the transfer, not the seat path.
  const seatCell = 0xaa61;
  const a = transfers()[0][1].clone();
  const before = a.mem8[seatCell];
  oracle(a);
  assert.equal(a.mem8[seatCell], before, "the crafted entry still seated, so the guard was not taken");
  console.log("  TRANSFER: both guard-fail entries equal outside the dead window, no seat, sp +2");
});

test("CORPUS: every dispatch of two tapes replays, and all take the seat path", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0, missed = 0, transferPath = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (mm.mem8[SENTINEL] !== 0x68) transferPath++;
      if (caught(compare(candidate, mm))) missed++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, missed, transferPath };
  };
  const coin = run({});
  const attract = run({ tape: [] });
  assert.equal(coin.dispatched, DISPATCHES.coin, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, DISPATCHES.attract, "the attract dispatch count moved");
  assert.ok(attract.dispatched > 0, "vacuous: attract never reached the routine");
  assert.equal(coin.missed + attract.missed, 0, "the rewrite diverged on a real dispatch");
  assert.equal(coin.transferPath + attract.transferPath, 0,
    "a natural dispatch now fails the sentinel, so the transfer path is no longer crafted-only");
  console.log(`  CORPUS: coin ${coin.dispatched}, attract ${attract.dispatched}, all seat path, identical`);
});

test("LIVE-OUT: the two cursors are the register live-out, and the check has teeth", { skip }, () => {
  assert.equal(compare(candidate, seatEntry()).cursor, null, "a cursor diverged on the real dispatch");
  // The cursors passing means nothing unless the same check catches a twin that scrambles one.
  assert.notEqual(compare(brokenMovesCursor, seatEntry()).cursor, null, "the cursor control was not caught");
  console.log("  LIVE-OUT: cursors agree; the scramble control is caught");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const r = compare(twin, seatEntry());
    assert.ok(caught(r), `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(r.escaped ?? r.cursor)}`);
  });
}
