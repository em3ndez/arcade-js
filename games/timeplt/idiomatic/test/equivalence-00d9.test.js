// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00d9 — memory-equivalent to the frozen oracle at ROM 0x00d9, the vertical-blank service.
 * GATE: unit-capture over a real corpus (the NMI dispatches this address once a frame), masking the
 * dead stack scratch and comparing RAM, every register, pc and the hardware latches. The mask width
 * is the oracle's own measured push depth; the floor is proved to sit above all game data, so the
 * window can hide nothing real. Teeth catch outside the mask, in memory and in the register file.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-00d9.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, START_FRAME, romsPresent } from "./_harness.js";
import { loc_00d9 } from "../loc_00d9.js";
import { loc_00d9 as oracle } from "../../translated/loc_00d9.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x00d9;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CORPUS_ENTRIES = 150;
/** Sampled across the whole run so the corpus spans attract AND the play the tape drives into. */
const CAPTURE_STRIDE = 8;
/** Every data write lands at or below here; the stack seats far above it, so the mask is safe. */
const DATA_TOP = 0xadff;

/** Empty: the epilogue restores every register from the stack, so none should end up moved. */
const MOVED = [];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── captured machines ──────────────────────────────────────────────────────────────────

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  let seen = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS_ENTRIES && seen % CAPTURE_STRIDE === 0) entries.push(mm.clone());
    seen++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture run ran short");
  assert.notEqual(entries.length, 0, "vacuous: the tape never reached the service");
  assert.ok(seen > START_FRAME, "the corpus never reached the frame the tape starts play on");
  captured = entries;
  return captured;
}

/** How far below its seat the oracle's own pushes reach, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => { const r = push(v); if (c.regs.sp < deepest) deepest = c.regs.sp; return r; };
  oracle(c);
  return seat - deepest;
}

let windowBytes = null;
function window() {
  if (windowBytes === null) windowBytes = Math.max(...capture().map(oracleDepth));
  return windowBytes;
}

const inWindow = (addr, seat) => addr !== null && addr >= seat - window() && addr < seat;

function ioDiff(a, b) {
  for (let bit = 0; bit < 8; bit++) {
    if (a.io.latch[bit] !== b.io.latch[bit]) {
      return { addr: null, a: `latch${bit}=${a.io.latch[bit]}`, b: `latch${bit}=${b.io.latch[bit]}` };
    }
  }
  if (a.io.soundData !== b.io.soundData) return { addr: null, a: `snd=${a.io.soundData}`, b: `snd=${b.io.soundData}` };
  if (a.io.watchdogKicks !== b.io.watchdogKicks) return { addr: null, a: `dog=${a.io.watchdogKicks}`, b: `dog=${b.io.watchdogKicks}` };
  return null;
}

/** Oracle vs candidate on independent clones: RAM outside the window, then registers, pc and IO. */
function unitDiff(candidate, machine) {
  const seat = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 50) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (!inWindow(addr, seat)) return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  if (a.pc !== b.pc) return { addr: null, a: `pc=${hex4(a.pc)}`, b: `pc=${hex4(b.pc)}` };
  return ioDiff(a, b);
}

/** How many bytes of the whole dump the oracle moves from this entry. */
function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── broken twins ───────────────────────────────────────────────────────────────────────

/** The prologue and the tail every twin shares, so a twin changes only the middle it targets. */
function prologue(m) {
  const { regs } = m;
  m.push16(regs.bc); m.push16(regs.de); m.push16(regs.hl);
  regs.exAf(); regs.exx();
  m.push16(regs.af); m.push16(regs.bc); m.push16(regs.de); m.push16(regs.hl);
  m.push16(regs.ix); m.push16(regs.iy);
}

function dispatchAndUnwind(m) {
  const { regs, mem8 } = m;
  m.push16(0x0155);
  m.call(0x48be);
  regs.a = mem8[0xa9ab] & 0x03;
  regs.hl = 0x015f;
  const word = m.mem16[regs.hl + 2 * regs.a];
  regs.de = regs.hl + 2 * regs.a + 2;
  regs.hl = word;
  m.push16(0x0174);
  m.call(word);
  return m.call(0x0174);
}

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: never steps the free-running frame counter. */
function brokenNoFrameCounter(m) {
  const { regs, mem8 } = m;
  prologue(m);
  m.call(0x0365); // note: reuses the frozen halves through m.call, only the counter is dropped
  m.call(0x5286);
  mem8[0xc300] = 0; mem8[0xc200] = 0;
  mem8[0xa987] = mem8[0xad32] !== 0 && mem8[0xa9c2] === 0 ? 0 : 1;
  mem8[0xc302] = mem8[0xa987];
  mem8[0xa9ad] = mem8[0xc200] ^ 0xff; mem8[0xa9ae] = mem8[0xc300] ^ 0xff;
  mem8[0xa9af] = mem8[0xc320] ^ 0xff; mem8[0xa9b0] = mem8[0xc340] ^ 0xff; mem8[0xa9b1] = mem8[0xc360] ^ 0xff;
  regs.a = regs.inc8(mem8[0xa9ce]); regs.daa(); mem8[0xa9ce] = regs.a;
  for (const t of [0xa817, 0xa812, 0xa8f4]) if (mem8[t] !== 0) mem8[t] = mem8[t] - 1;
  return dispatchAndUnwind(m);
}

/** BUG: latches the raw ports instead of their inverse. */
function brokenNoInvert(m) {
  const { regs, mem8 } = m;
  prologue(m);
  m.call(0x0365); m.call(0x5286);
  mem8[0xc300] = 0; mem8[0xc200] = 0;
  mem8[0xa987] = mem8[0xad32] !== 0 && mem8[0xa9c2] === 0 ? 0 : 1;
  mem8[0xc302] = mem8[0xa987];
  mem8[0xa9ad] = mem8[0xc200]; mem8[0xa9ae] = mem8[0xc300];
  mem8[0xa9af] = mem8[0xc320]; mem8[0xa9b0] = mem8[0xc340]; mem8[0xa9b1] = mem8[0xc360];
  mem8[0xa980] = mem8[0xa980] + 1;
  regs.a = regs.inc8(mem8[0xa9ce]); regs.daa(); mem8[0xa9ce] = regs.a;
  for (const t of [0xa817, 0xa812, 0xa8f4]) if (mem8[t] !== 0) mem8[t] = mem8[t] - 1;
  return dispatchAndUnwind(m);
}

/** BUG: leaves the service flag high unconditionally, dropping the gate condition. */
function brokenWrongGate(m) {
  const { regs, mem8 } = m;
  prologue(m);
  m.call(0x0365); m.call(0x5286);
  mem8[0xc300] = 0; mem8[0xc200] = 0;
  mem8[0xa987] = 1;
  mem8[0xc302] = mem8[0xa987];
  mem8[0xa9ad] = mem8[0xc200] ^ 0xff; mem8[0xa9ae] = mem8[0xc300] ^ 0xff;
  mem8[0xa9af] = mem8[0xc320] ^ 0xff; mem8[0xa9b0] = mem8[0xc340] ^ 0xff; mem8[0xa9b1] = mem8[0xc360] ^ 0xff;
  mem8[0xa980] = mem8[0xa980] + 1;
  regs.a = regs.inc8(mem8[0xa9ce]); regs.daa(); mem8[0xa9ce] = regs.a;
  for (const t of [0xa817, 0xa812, 0xa8f4]) if (mem8[t] !== 0) mem8[t] = mem8[t] - 1;
  return dispatchAndUnwind(m);
}

/** BUG: never runs the per-frame subsystems. */
function brokenNoSubsystems(m) {
  const { regs, mem8 } = m;
  prologue(m);
  m.call(0x0365); m.call(0x5286);
  mem8[0xc300] = 0; mem8[0xc200] = 0;
  mem8[0xa987] = mem8[0xad32] !== 0 && mem8[0xa9c2] === 0 ? 0 : 1;
  mem8[0xc302] = mem8[0xa987];
  mem8[0xa9ad] = mem8[0xc200] ^ 0xff; mem8[0xa9ae] = mem8[0xc300] ^ 0xff;
  mem8[0xa9af] = mem8[0xc320] ^ 0xff; mem8[0xa9b0] = mem8[0xc340] ^ 0xff; mem8[0xa9b1] = mem8[0xc360] ^ 0xff;
  mem8[0xa980] = mem8[0xa980] + 1;
  regs.a = regs.inc8(mem8[0xa9ce]); regs.daa(); mem8[0xa9ce] = regs.a;
  for (const t of [0xa817, 0xa812, 0xa8f4]) if (mem8[t] !== 0) mem8[t] = mem8[t] - 1;
  regs.a = mem8[0xa9ab] & 0x03;
  regs.hl = 0x015f;
  const word = m.mem16[regs.hl + 2 * regs.a];
  regs.de = regs.hl + 2 * regs.a + 2; regs.hl = word;
  m.push16(0x0174); m.call(word);
  return m.call(0x0174);
}

/** BUG: scribbles an index register after unwinding — the control for the register arm. */
function brokenMovesRegister(m) {
  loc_00d9(m);
  m.regs.iy = (m.regs.iy + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-frame-counter", brokenNoFrameCounter],
  ["no-invert", brokenNoInvert],
  ["wrong-gate", brokenWrongGate],
  ["no-subsystems", brokenNoSubsystems],
];

// ── the gate ───────────────────────────────────────────────────────────────────────────

test("CORPUS: every captured dispatch replays identically outside the window", { skip }, () => {
  const entries = capture();
  for (const e of entries) {
    const d = unitDiff(loc_00d9, e);
    assert.equal(d, null, show(d));
  }
  const foot = entries.map(footprint);
  assert.ok(foot.some((n) => n > 0),
    "every captured dispatch makes the oracle write nothing, so a do-nothing rewrite would pass");
  console.log(`  CORPUS: ${entries.length} dispatches identical outside a ${window()}-byte window; ` +
    `footprints ${Math.min(...foot)}..${Math.max(...foot)} bytes`);
});

test("WINDOW: the mask is the oracle's push depth, its floor clears the data, instrument works", { skip }, () => {
  const depths = capture().map(oracleDepth);
  const seat = capture()[0].regs.sp;
  // The measurement is evidence only because the same instrument sees a push it is handed.
  const probe = capture()[0].clone();
  let seen = probe.regs.sp;
  const push = probe.push16.bind(probe);
  probe.push16 = (v) => { const r = push(v); if (probe.regs.sp < seen) seen = probe.regs.sp; return r; };
  probe.push16(0x1234);
  assert.equal(seat - seen, 2, "the depth instrument does not notice a push it was handed");
  assert.ok((seat - window()) > DATA_TOP,
    `the mask floor ${hex4(seat - window())} reached down into game data at or below ${hex4(DATA_TOP)}`);
  console.log(`  WINDOW: depth ${Math.min(...depths)}..${Math.max(...depths)} bytes; ` +
    `floor ${hex4(seat - window())} clears data top ${hex4(DATA_TOP)}`);
});

test("BOUNDARY: a byte below the window is caught, one inside is masked", { skip }, () => {
  const base = capture()[0];
  const scribbler = (offset) => (m) => {
    loc_00d9(m);
    const at = (base.regs.sp + offset) & 0xffff;
    m.mem8[at] = (m.mem8[at] + 1) & 0xff;
  };
  const below = unitDiff(scribbler(-window() - 1), base);
  const seatByte = unitDiff(scribbler(0), base);
  const inside = unitDiff(scribbler(-1), base);
  assert.notEqual(below, null, "a divergence below the window was swallowed, so the mask is too wide");
  assert.notEqual(seatByte, null, "a divergence at the entry seat was swallowed");
  assert.equal(inside, null, "a divergence inside the window was caught, so the catches prove nothing");
  console.log(`  BOUNDARY: ${hex4(base.regs.sp - window() - 1)} caught, ${hex4(base.regs.sp)} caught, ` +
    `${hex4(base.regs.sp - 1)} masked`);
});

test("REGISTERS: nothing moves, with a control twin that moves one", { skip }, () => {
  const base = capture()[0];
  const clean = unitDiff(loc_00d9, base);
  const control = unitDiff(brokenMovesRegister, base);
  assert.equal(clean, null, `a register moved: ${show(clean)}`);
  assert.notEqual(control, null,
    "a twin that scribbles an index register was not caught, so the clean reading proves nothing");
  console.log("  REGISTERS: rewrite moves nothing; the scribbling control twin is caught");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const entries = capture();
    const caught = entries.filter((e) => unitDiff(twin, e) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught}/${entries.length} dispatches`);
    assert.ok(caught > 0, `every dispatch PASSED the ${label} twin — the gate has no teeth against it`);
  });
}
