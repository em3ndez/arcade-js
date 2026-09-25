// SPDX-License-Identifier: GPL-3.0-only
/** stepMotherShip — memory-equivalent to the frozen oracle. Nothing dispatches this deep-state driver on
 * either tape (a live control proves the run counts), so it runs on CRAFTED entries poked onto real
 * captured machines to force every state-byte arm, full work-RAM compared with the dead stack scratch
 * masked off both sides' pushes, index registers held, and broken twins caught in memory.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-43f0.test.js */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { stepMotherShip as candidate } from "../stepMotherShip.js";
import { loc_598e } from "../loc_598e.js";
import { loc_5994 } from "../loc_5994.js";
import { loc_43f0 as oracle } from "../../translated/loc_43f0.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x43f0;
const ANCHOR = 0x43b7; // reached on the tape; seats this object's bank
const RECORD = 0xa8a0;
const SPRITE = 0xaa24;
const GATE = 0xad0d; // the caller's deep-state gate
const STACK_FLOOR = 0xae00; // data below, the stack seats up at 0xb000
const BASES = 2;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
/** The scratch the vanished ret and the dissolved callees' dropped pushes leave; a SUBSET, so an
 *  exact rewrite still passes. Index registers are held — they are the routine's real pointer live-out. */
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp",
  "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

const COOLDOWN = 0xa817;
function liveProximity(c) {
  c.mem8[COOLDOWN] = 0x00;
  c.mem8[0xa827] = 0x10; // half-width, so the near-band test admits the player
  c.mem8[SPRITE + 0x00] = 0x40;
  c.mem8[SPRITE + 0x31] = 0x40;
}

// [label, state byte, mutator forcing that arm's reads]
const WRITING = [
  ["idle-delay", 0x00, (c) => { c.mem8[RECORD + 0x0e] = 0x05; }],
  ["idle-spawn-neg", 0x00, (c) => { c.mem8[RECORD + 0x0e] = 0; c.mem8[0xacc6] = 0; c.mem8[0xa980] = 0x00; c.mem8[RECORD + 0x04] = 0x0a; c.mem8[0xad04] = 0x01; }],
  ["idle-spawn-keep", 0x00, (c) => { c.mem8[RECORD + 0x0e] = 0; c.mem8[0xacc6] = 0; c.mem8[0xa980] = 0x08; c.mem8[RECORD + 0x04] = 0x02; c.mem8[0xad04] = 0x00; }],
  ["countdown", 0x05, (c) => { c.mem8[RECORD + 0x04] = 0x03; }],
  ["rebuild", 0xef, (c) => { c.mem8[RECORD + 0x04] = 0; c.mem8[0xa810] = 0xff; c.mem8[0xa820] = 0xfe; c.mem8[0xa830] = 0x05; }],
  ["flash-warp", 0xb4, (c) => { c.mem8[RECORD + 0x04] = 0; c.mem8[0xa800] = 0xff; }],
  ["below-trigger", 0x30, (c) => { c.mem8[RECORD + 0x04] = 0; }],
  ["above-trigger", 0xc4, (c) => { c.mem8[RECORD + 0x04] = 0; }],
  ["spend-idle", 0x01, (c) => { c.mem8[RECORD + 0x04] = 0; }],
  ["spend-warp", 0x01, (c) => { c.mem8[RECORD + 0x04] = 0; c.mem8[0xab43] = 0x00; }], // 4646 -> 459b tail
  ["reach-5a", 0x5b, (c) => { c.mem8[RECORD + 0x04] = 0; }],
  ["live-cooldown", 0xff, (c) => { c.mem8[COOLDOWN] = 0x01; }],
  ["live-nofree", 0xff, (c) => { liveProximity(c); c.mem8[0xa830] = 0x11; c.mem8[0xa840] = 0x22; }],
  ["live-spawn", 0xff, (c) => { liveProximity(c); c.mem8[0xa830] = 0x00; c.mem8[0xad04] = 0x00; }], // stage 0 arm
  ["live-spawn-s2", 0xff, (c) => { liveProximity(c); c.mem8[0xa830] = 0x00; c.mem8[0xad04] = 0x02; }], // stage 2 arm
  ["live-noprox", 0xff, (c) => { c.mem8[COOLDOWN] = 0; c.mem8[SPRITE + 0] = 0; c.mem8[SPRITE + 0x31] = 0; }],
];
// An arm that only reads and returns — its live-out is that it writes nothing.
const EARLY = ["idle-locked", 0x00, (c) => { c.mem8[RECORD + 0x0e] = 0; c.mem8[0xacc6] = 0x01; }];

let cache = null;
function setup() {
  if (cache) return cache;
  const bases = [];
  let anchorHits = 0, targetHits = 0;
  const realAnchor = TRANSLATED.get(ANCHOR);
  const realTarget = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([
    [ANCHOR, (mm) => { if (anchorHits % 80 === 0 && bases.length < BASES) bases.push(mm.clone()); anchorHits++; return realAnchor(mm); }],
    [TARGET, (mm) => { targetHits++; return realTarget(mm); }],
  ]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  cache = { bases, anchorHits, targetHits };
  return cache;
}
const bases = () => setup().bases;

function craft(base, state, mut) {
  const c = base.clone();
  c.mem8[RECORD] = state;
  c.mem8[GATE] = 0x01; // arm the deep-state gate the caller would have set
  mut(c);
  return c;
}
function corpus(rows = WRITING) {
  const out = [];
  for (const base of bases()) for (const [label, st, mut] of rows) out.push([label, craft(base, st, mut)]);
  return out;
}

/** Oracle vs candidate on independent clones, the stack scratch both sides push masked off. */
function compare(cand, machine) {
  const a = machine.clone(), b = machine.clone();
  const scratch = new Set();
  let minSp = a.regs.sp;
  const track = (mm) => {
    const push = mm.push16.bind(mm);
    mm.push16 = (v) => { const sp = (mm.regs.sp - 2) & 0xffff; scratch.add(sp).add((sp + 1) & 0xffff); if (sp < minSp) minSp = sp; push(v); };
  };
  track(a); track(b);
  oracle(a); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (scratch.has(addr)) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
  }
  return { escaped, reg, minSp };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  const cells = new Set();
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr < STACK_FLOOR) cells.add(addr); // data writes only
  }
  return cells;
}

test("SETUP: the tape never dispatches this deep-state routine, with a live control", { skip }, () => {
  const s = setup();
  assert.equal(s.targetHits, 0, "this routine now dispatches on the tape; capture plain entries instead");
  assert.ok(s.anchorHits > 0, "the anchor was never reached, so the zero above proves nothing");
  assert.equal(s.bases.length, BASES, "the base count moved");
  console.log(`  SETUP: target ${s.targetHits}, control anchor ${s.anchorHits}, bases ${s.bases.length}`);
});

test("EQUAL: every crafted arm replays identically, and the corpus is not vacuous", { skip }, () => {
  const rows = corpus([...WRITING, EARLY]);
  for (const [label, c] of rows) {
    const r = compare(candidate, c);
    assert.equal(r.escaped, null, `${label}: escaped at ${r.escaped && hex4(r.escaped.addr)} oracle=${r.escaped && r.escaped.oracle} rewrite=${r.escaped && r.escaped.candidate}`);
    assert.equal(r.reg, null, `${label}: index register ${r.reg && r.reg.k} diverged (${r.reg && r.reg.a} vs ${r.reg && r.reg.b})`);
    assert.ok(r.minSp > STACK_FLOOR, `${label}: a push reached ${hex4(r.minSp)}, into game data`);
  }
  console.log(`  EQUAL: ${rows.length} crafted entries identical outside the scratch`);
});

test("INFORMATIVE: writing arms move memory, the early-ret arm writes nothing", { skip }, () => {
  for (const [label, c] of corpus()) assert.ok(footprint(c).size > 0, `${label} moved no memory, so a no-op would pass it`);
  for (const [label, c] of corpus([EARLY])) assert.equal(footprint(c).size, 0, `${label} wrote memory; it is meant to be a pure early return`);
  console.log(`  INFORMATIVE: ${corpus().length} writing entries all move memory; the locked-out arm writes nothing`);
});

test("PATHS: the arms move different cells, so a twin confusing them is not invisible", { skip }, () => {
  const foot = (label) => footprint(craft(bases()[0], ...pick(label)));
  const eq = (x, y) => x.size === y.size && [...x].every((v) => y.has(v));
  assert.ok(!eq(foot("rebuild"), foot("live-spawn")), "the rebuild and live-spawn arms touch the same cells");
  assert.ok(!eq(foot("idle-delay"), foot("countdown")), "the idle and countdown arms touch the same cells");
  console.log(`  PATHS: rebuild ${foot("rebuild").size}, live-spawn ${foot("live-spawn").size}, idle ${foot("idle-delay").size} cells`);
});
function pick(label) {
  const row = WRITING.find((r) => r[0] === label);
  return [row[1], row[2]];
}

test("REGISTERS: index registers are held, with a control that moves one", { skip }, () => {
  const movesIx = (m) => { const r = candidate(m); m.regs.ix = (m.regs.ix + 1) & 0xffff; return r; };
  let control = 0;
  for (const [, c] of corpus()) {
    assert.equal(compare(candidate, c).reg, null, "a held register diverged");
    if (compare(movesIx, c).reg) control++;
  }
  assert.ok(control > 0, "the register check passed a twin that scribbles ix, so a clean reading proves nothing");
  console.log(`  REGISTERS: ix/iy held on ${corpus().length} entries; the ix-scribble control caught on ${control}`);
});

const noOp = () => {};
const scribbleData = (m) => { candidate(m); m.mem8[RECORD + 0x20] ^= 0xff; };
// The body re-expresses its Z80 main-register scratch as JS locals, so only ix/iy are pinned. A twin
// that scribbles a main register after the routine is DELIBERATELY not flagged -- the same memory
// measurement must still catch a scribbled RAM cell, or the clean read on the register twin is worthless.
const scribbleScratchReg = (m) => { candidate(m); m.regs.a = (m.regs.a + 1) & 0xff; m.regs.b = (m.regs.b + 1) & 0xff; };

test("SCRATCH NOT PINNED: a main-register-only twin passes; a RAM scribble is caught", { skip }, () => {
  for (const [label, c] of corpus()) {
    const r = compare(scribbleScratchReg, c);
    assert.equal(r.escaped, null, `${label}: a scratch-register scribble moved memory`);
    assert.equal(r.reg, null, `${label}: a scratch register was pinned, but only ix/iy are live-out`);
    assert.ok(biteInMemory(scribbleData, c), `${label}: the RAM measurement missed a scribbled cell, so it has no teeth`);
  }
  console.log(`  SCRATCH NOT PINNED: register twin ignored; RAM twin caught on all ${corpus().length}`);
});

/** memory-only catch, so the held-register check cannot be what is biting. */
function biteInMemory(twin, machine) {
  const a = machine.clone(), b = machine.clone();
  const scratch = new Set();
  const push = a.push16.bind(a);
  a.push16 = (v) => { const sp = (a.regs.sp - 2) & 0xffff; scratch.add(sp).add((sp + 1) & 0xffff); push(v); };
  const bpush = b.push16.bind(b);
  b.push16 = (v) => { const sp = (b.regs.sp - 2) & 0xffff; scratch.add(sp).add((sp + 1) & 0xffff); bpush(v); };
  oracle(a);
  try { twin(b); } catch { return true; }
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    if (scratch.has(a.stateOffsetToAddr(i))) continue;
    return true;
  }
  return false;
}

test("TEETH: broken twins are caught in memory on every writing arm", { skip }, () => {
  const rows = corpus();
  for (const [label, c] of rows) {
    assert.ok(biteInMemory(noOp, c), `the no-op twin escaped ${label}`);
    assert.ok(biteInMemory(scribbleData, c), `the data-scribble twin escaped ${label}`);
  }
  console.log(`  TEETH: no-op and data-scribble caught on all ${rows.length} writing entries`);
});

// The launch path picks one of two stage arms by the era and lands the pair it hands back into the
// spawned record's 0x0a..0x0d cells. Those cells are ordinary work RAM the EQUAL comparison covers,
// so a dispatch that ran the wrong arm would land the wrong pair and fail EQUAL on one of the two
// live-spawn entries. This is the positive control that the two arms are genuinely different: pointed
// at the same heading they hand back different pairs, so choosing between them is observable and the
// EQUAL check above has teeth over the choice. If they ever agreed, EQUAL could not catch a swap.
const STAGE_HEADINGS = [0x08, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0];
test("STAGE ARMS DIFFER: the two era arms hand back different vectors, so the dispatch is observable", { skip }, () => {
  const vec = (arm, heading) => {
    const m = bases()[0].clone();
    m.regs.ix = RECORD;
    m.mem8[RECORD + 0x02] = heading;
    arm(m);
    return [m.regs.e, m.regs.d, m.regs.c, m.regs.b];
  };
  let differing = 0;
  for (const h of STAGE_HEADINGS) {
    const a = vec(loc_598e, h);
    const b = vec(loc_5994, h);
    if (a.some((v, i) => v !== b[i])) differing++;
  }
  assert.ok(
    differing > 0,
    "the two stage arms handed back the same vector on every heading tried, so a dispatch that " +
      "picked the wrong arm could never be caught by the EQUAL memory comparison",
  );
  console.log(`  STAGE ARMS DIFFER: ${differing} of ${STAGE_HEADINGS.length} headings distinguish the two arms`);
});
