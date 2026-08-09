// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0167 — memory-equivalent to the frozen oracle at ROM 0x0167.
 * GATE: crafted entries — a derail address nothing dispatches — with the pointer aimed at work RAM
 *   so the one bump lands writably. RAM is compared outside the oracle's OWN measured push-scratch,
 *   plus every register, pc and the control latches; the +26 SP drift and the bumped cell are
 *   asserted; teeth. Run: node --test games/timeplt/idiomatic/test/equivalence-0167.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0167 as candidate } from "../loc_0167.js";
import { loc_0167 as oracle } from "../../translated/loc_0167.js";
import { loc_0174 as cap0174 } from "../../translated/loc_0174.js";
import { fetchTableWord } from "../fetchTableWord.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt as epilogue } from "../sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8 } from "../../../../core/int.js";

const TARGET = 0x0167;
const CONTROL = 0x0174;
const PENDING_COUNT = 0xac43;
const FIRST_PENDING = 0xac44;
const WORK_PAGE = 0xab00;
const SP_DRIFT = 26;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── real machines, then crafted entries ──────────────────────────────────────────────────

let raw = null;
function rawStates() {
  if (raw) return raw;
  const entries = [];
  const m = makeMachine(new Map([[CONTROL, (mm) => {
    if (entries.length < 40) entries.push(mm.clone());
    return cap0174(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture run ran short");
  assert.notEqual(entries.length, 0, "vacuous: the tape never reached the control address");
  raw = entries;
  return raw;
}

/** A real machine with the accumulator (and so the pointer) aimed at a writable work-RAM cell, and
 * a stale l != a so a twin that drops the pointer load lands elsewhere. */
function craft(base, aByte, queueCount) {
  const c = base.clone();
  c.regs.h = (WORK_PAGE >> 8) & 0xff;
  c.regs.a = aByte & 0xff;
  c.regs.l = (aByte ^ 0xff) & 0xff;
  c.mem8[PENDING_COUNT] = queueCount;
  for (let i = 0; i < 16; i++) c.mem8[FIRST_PENDING + i] = 0x40 + i;
  return c;
}

function corpus() {
  return rawStates().map((b, i) => craft(b, (i * 7 + 3) & 0xff, i % 4));
}

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/** Oracle vs candidate on clones. The oracle pushes return addresses its dissolved callees no
 * longer do; those exact bytes are recorded and masked. Everything else — RAM, registers, pc and
 * the control/sound latches — is held equal. */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  const pushed = new Set();
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); pushed.add(a.regs.sp); pushed.add((a.regs.sp + 1) & 0xffff); };

  let threw = null;
  const retO = oracle(a);
  let retC;
  try { retC = cand(b); } catch (e) { threw = String(e).slice(0, 60); }

  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (!pushed.has(addr)) escaped = { addr, o: da[i], c: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) { reg = { k, o: a.regs[k], c: b.regs[k] }; break; }
  let io = null;
  for (let bit = 0; bit < 8; bit++) if (a.io.latch[bit] !== b.io.latch[bit]) io = { latch: bit };
  if (a.io.soundData !== b.io.soundData) io = io || { sound: true };
  const pcDiff = a.pc === b.pc ? null : { o: a.pc, c: b.pc };
  return { threw, escaped, reg, io, pcDiff, spDiff: (a.regs.sp - b.regs.sp) & 0xffff,
    drift: (a.regs.sp - seat) & 0xffff, seat, pushed, ret: retO === retC };
}

const diverged = (r) => r.threw || r.escaped || r.reg || r.io || r.pcDiff || r.spDiff !== 0;
const show = (r) => JSON.stringify({ threw: r.threw, escaped: r.escaped, reg: r.reg, io: r.io, pc: r.pcDiff, spDiff: r.spDiff });

// ── broken twins ──────────────────────────────────────────────────────────────────────────

const noop = () => {};
const skipInc = (m) => { m.regs.l = m.regs.a; fetchTableWord(m); m.pop16(); m.pop16(); return epilogue(m); };
const wrongCell = (m) => { m.mem8[m.regs.hl] = u8(m.mem8[m.regs.hl] + 1); fetchTableWord(m); m.pop16(); m.pop16(); return epilogue(m); };
const onePop = (m) => { m.regs.l = m.regs.a; m.mem8[m.regs.hl] = u8(m.mem8[m.regs.hl] + 1); fetchTableWord(m); m.pop16(); return epilogue(m); };
const skipEpilogue = (m) => { m.regs.l = m.regs.a; m.mem8[m.regs.hl] = u8(m.mem8[m.regs.hl] + 1); fetchTableWord(m); m.pop16(); m.pop16(); };
const movesReg = (m) => { candidate(m); m.regs.iy = (m.regs.iy + 1) & 0xffff; };

const TWINS = [
  ["no-op", noop],
  ["skip-bump", skipInc],
  ["wrong-cell", wrongCell],
  ["short-unwind", onePop],
  ["no-epilogue", skipEpilogue],
  ["scribble-register", movesReg],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: nothing dispatches this derail address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [CONTROL]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [CONTROL, (mm) => { seen[CONTROL]++; return cap0174(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.ok(seen[CONTROL] > 0, `${label} counted nothing at the control, so the zero means nothing`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches this address, so plain captures are available`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} entered ${seen[TARGET]}, control ${seen[CONTROL]}`);
  }
});

test("CRAFTED: every entry replays identically outside the oracle's own pushes", { skip }, () => {
  const entries = corpus();
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.ok(!diverged(r), show(r));
  }
  console.log(`  CRAFTED: ${entries.length} entries identical (RAM, registers, pc, latches), spDiff 0`);
});

test("SEAT: the stack unwinds 26 bytes on both sides and control resumes together", { skip }, () => {
  const r = compare(candidate, corpus()[0]);
  assert.equal(r.drift, SP_DRIFT, "the oracle no longer unwinds the frame this file rests on");
  assert.equal(r.spDiff, 0, "the rewrite left the stack at a different depth");
  assert.equal(r.pcDiff, null, "the two sides resume at different addresses");
  assert.ok(r.ret, "the return values differ");
  console.log(`  SEAT: ${hex4(r.seat)} -> +${r.drift} on both sides, pc agrees`);
});

test("BUMP: the one work-RAM write lands where the accumulator points, and really moves it", { skip }, () => {
  const e = craft(rawStates()[0], 0x55, 0);
  const cell = WORK_PAGE | 0x55;
  const before = e.mem8[cell];
  const a = e.clone();
  oracle(a);
  assert.equal(a.mem8[cell], u8(before + 1), "the oracle no longer bumps the pointed-at cell");
  const r = compare(candidate, e);
  assert.ok(!diverged(r), `the bump path diverged — ${show(r)}`);
  console.log(`  BUMP: ${hex4(cell)} ${before} -> ${u8(before + 1)} on both sides`);
});

test("MASK: the push-scratch is masked and a real cell beside it is caught", { skip }, () => {
  const base = craft(rawStates()[0], 0x50, 0);
  const pushed = [...compare(candidate, base).pushed];
  const scribbler = (addr) => (m) => { candidate(m); m.mem8[addr] = (m.mem8[addr] + 1) & 0xff; };
  assert.ok(!diverged(compare(scribbler(pushed[0]), base)), "a scribble on a pushed byte was caught, so the mask is too narrow");
  assert.ok(diverged(compare(scribbler(base.regs.sp), base)), "a scribble at the seat was masked, so the mask reaches memory the oracle never wrote");
  assert.ok(diverged(compare(scribbler(WORK_PAGE | 0x60), base)), "a scribble on a plain work cell was masked");
  console.log(`  MASK: ${pushed.length} pushed bytes masked; the seat and a work cell caught`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const entries = corpus();
    const caught = entries.filter((e) => diverged(compare(twin, e))).length;
    console.log(`  TEETH/${label}: caught on ${caught}/${entries.length}`);
    assert.equal(caught, entries.length, `the ${label} twin escaped an entry`);
  });
}
