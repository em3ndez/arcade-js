// SPDX-License-Identifier: GPL-3.0-only
/**
 * advancePlayerAnimationStrip vs the frozen oracle: the coin-start tape reaches this address directly, so real captured
 * dispatches drive the REAL arm, and crafted entries force each decision branch. A pure leaf — every
 * call dissolved to a direct import — so the rewrite omits its own ret; the dead stack scratch is
 * masked off the oracle's own pushes and the flag byte and SP held to a measured ceiling.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2010.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advancePlayerAnimationStrip as candidate } from "../advancePlayerAnimationStrip.js";
import { loc_2010 as oracle } from "../../translated/loc_2010.js";
import { loc_1f2e } from "../loc_1f2e.js";
import { requestLateEraProgressSound } from "../requestLateEraProgressSound.js";
import { requestRoundIntroSoundBurst } from "../requestRoundIntroSoundBurst.js";
import { offsetAddress } from "../offsetAddress.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2010;
const CAP = 60;

const PHASE = 0x00;
const FIRST_FRAME = 0xb4;
const LEVEL_CELL = 0xad04;
const STATE_HI = 0xabfe;
const STATE_LO = 0xabff;
const RUNNING = 0xa5;

// Every data write lands at or below here; the seat sits far above it, so masking the scratch can
// never hide a real byte. Checked against the watched floor below.
const DATA_TOP = 0xadff;
// The advance callee is flag-free by design and the rewrite leaves the ROM ret to the live seam, so
// the flag byte and SP are adrift; asserted as a SUBSET so an exact rewrite still passes.
const EXCLUDED = ["f", "sp"];

const FRAME_ARMS = [
  [0xb3, 0x1f76], [0xab, 0x1f94], [0xa3, 0x1fb2], [0x9b, 0x1fd0],
  [0x93, 0x1fd0], [0x8b, 0x1fb2], [0x83, 0x1fee],
];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── real dispatches ─────────────────────────────────────────────────────────────────────────────

let capturedCache = null;
function captured() {
  if (capturedCache) return capturedCache;
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting && entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  capturedCache = entries;
  return entries;
}

// ── the masked comparison ───────────────────────────────────────────────────────────────────────

// Oracle vs candidate on independent clones. The frozen side pushes below its seat and pops a return
// the rewrite never models, so [low, seat) is masked with low watched off the oracle's own pushes.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const rO = oracle(a);
  let rC, threw = null;
  try { rC = cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (threw || da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let reg = null;
  if (!threw) {
    for (const k of REG_FIELDS) {
      if (EXCLUDED.includes(k)) continue;
      if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
    }
  }
  return { escaped, reg, threw, low, seat, spDiff: a.regs.sp - b.regs.sp, rO, rC };
}
const diverges = (cand, m) => { const r = compare(cand, m); return !!(r.escaped || r.reg || r.threw); };

// Bytes the oracle moves from a state — the scenario's footprint.
function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── crafted scenarios: one per decision branch ────────────────────────────────────────────────

function craft(head, hi, lo, level) {
  const c = captured()[0].clone();
  c.mem8[(c.regs.ix + PHASE) & 0xffff] = head;
  c.mem8[STATE_HI] = hi;
  c.mem8[STATE_LO] = lo;
  c.mem8[LEVEL_CELL] = level;
  return c;
}

// [label, machine, exit is a tail-divert]. Head < the cap takes the near branch; >= it takes the
// first-frame branch, whose two state cells then draw, divert, or draw again.
let scenCache = null;
function scen() {
  if (scenCache) return scenCache;
  scenCache = [
    ["A-draw", craft(0xa4, RUNNING, 0x10, 0x00), false],
    ["A-nodraw", craft(0xb2, RUNNING, 0x10, 0x00), false],
    ["B-drawA", craft(0xf0, RUNNING, 0x05, 0x03), false],
    ["B-drawB", craft(0xf0, RUNNING, 0x10, 0x03), false],
    ["B-tailHi", craft(0xf0, 0x00, 0x10, 0x03), true],
    ["B-tailLo", craft(0xf0, RUNNING, 0x07, 0x03), true],
    ["B-cue", craft(0xf0, RUNNING, 0x05, 0x05), false],
  ];
  return scenCache;
}

// ── broken twins: the body re-derived, each with one defect ──────────────────────────────────────

function makeBody(o = {}) {
  return function body(m) {
    if (o.noOp) return;
    const { regs, mem, mem8 } = m;
    regs.a = mem8[regs.ix & 0xffff];
    regs.cp(FIRST_FRAME);
    if (!regs.fC) {
      if (!o.skipClamp) mem8[regs.ix & 0xffff] = FIRST_FRAME;
      mem8[(regs.iy + 1) & 0xffff] = 0xff;
      regs.a = mem8[LEVEL_CELL];
      regs.cp(0x02);
      if (!regs.fC) requestLateEraProgressSound(m);
      requestRoundIntroSoundBurst(m);
      regs.a = mem8[STATE_HI];
      regs.cp(RUNNING);
      if (regs.fNZ) return o.dropDivert ? undefined : loc_1f2e(m);
      regs.de = STATE_LO;
      regs.a = mem8[regs.de];
      regs.cp(0x05);
      if (regs.fNZ) {
        regs.cp(0x10);
        if (regs.fNZ) return o.dropDivert ? undefined : loc_1f2e(m);
      }
    }
    regs.decMem8(mem, regs.ix & 0xffff);
    regs.a = mem8[regs.ix & 0xffff];
    let base = null;
    for (const [f, t] of FRAME_ARMS) { regs.cp(f); if (regs.fZ) { base = t; break; } }
    if (base === null) return;
    regs.de = base;
    regs.hl = 0xa5af;
    regs.b = 0xc1;
    regs.a = mem8[LEVEL_CELL];
    regs.add(regs.b);
    regs.c = o.wrongColour ? (regs.a + 1) & 0xff : regs.a;
    regs.exx();
    regs.a = mem8[0x337a];
    regs.b = regs.a;
    do {
      regs.exx();
      regs.a = mem8[0x4902];
      regs.b = regs.a;
      do {
        regs.a = mem8[regs.de];
        mem8[regs.hl] = regs.a;
        regs.h = regs.res(2, regs.h);
        mem8[regs.hl] = regs.c;
        regs.h = regs.set(2, regs.h);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
      } while (regs.djnz() !== 0);
      regs.a = 0x1b;
      offsetAddress(m);
      regs.exx();
    } while (regs.djnz() !== 0);
  };
}

// The control for EXCLUDED: scribbles a register the routine has no business touching.
function movesSpare(m) { const r = candidate(m); m.regs.h = (m.regs.h + 1) & 0xff; return r; }

// [label, twin, the scenario labels it must be caught on].
const TWINS = [
  ["no-op", makeBody({ noOp: true }), ["A-draw", "A-nodraw", "B-drawA", "B-drawB", "B-tailHi", "B-tailLo", "B-cue"]],
  ["skip-clamp", makeBody({ skipClamp: true }), ["B-drawA", "B-drawB", "B-tailHi", "B-tailLo", "B-cue"]],
  ["wrong-colour", makeBody({ wrongColour: true }), ["A-draw", "B-drawA", "B-drawB", "B-cue"]],
  ["drop-divert", makeBody({ dropDivert: true }), ["B-tailHi", "B-tailLo"]],
];

function movedOver(cand) {
  const moved = new Set();
  for (const [, c] of scen()) {
    const a = c.clone();
    const b = c.clone();
    oracle(a);
    try { cand(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────────

test("REAL: every captured dispatch replays identically, and some write", { skip }, () => {
  const entries = captured();
  assert.ok(entries.length > 0, "vacuous: the coin-start tape no longer reaches this address");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.threw, null, r.threw && `the candidate threw: ${r.threw}`);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, r.reg && `register ${r.reg && r.reg.k} diverged`);
  }
  const wrote = entries.filter((e) => footprint(e) > 0).length;
  assert.ok(wrote > 0, "no captured dispatch makes the oracle write, so this arm would pass a no-op");
  console.log(`  REAL: ${entries.length} dispatches identical, ${wrote} of them write`);
});

test("BRANCHES: every crafted decision branch replays, and the branches really differ", { skip }, () => {
  for (const [label, c] of scen()) {
    const r = compare(candidate, c);
    assert.equal(r.escaped, null, `${label}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${label}: register ${r.reg && r.reg.k} diverged`);
  }
  // ★ Vacuity guard: a draw moves the strip, a no-draw moves only the stepped phase, a divert moves
  // what the heading snap leaves — so a rewrite that confused them could not pass all seven.
  const foot = Object.fromEntries(scen().map(([n, c]) => [n, footprint(c)]));
  assert.equal(foot["A-nodraw"], 1, "the no-draw branch moved more than the stepped phase");
  assert.ok(foot["B-drawA"] > foot["A-nodraw"] && foot["B-tailHi"] > foot["A-nodraw"],
    "a draw or divert branch moved no more than the no-draw one");
  console.log(`  BRANCHES: ${scen().length} identical; footprints ${Object.entries(foot).map(([n, v]) => `${n}=${v}`).join(" ")}`);
});

test("SP AND RETURN: ret paths re-seat two bytes higher, tails zero, mask floor over the data",
  { skip }, () => {
    for (const [label, c, isTail] of scen()) {
      const r = compare(candidate, c);
      assert.equal(r.spDiff, isTail ? 0 : 2, `${label}: SP re-seat moved`);
      assert.ok(r.low > DATA_TOP, `${label}: the stack window ${hex4(r.low)} reached into game data`);
      assert.equal(r.rO, r.rC, `${label}: the return value diverged`);
    }
    console.log("  SP: +2 on ret paths, 0 on tails; window over the data; returns identical");
  });

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(candidate);
  const control = movedOver(movesSpare);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles a register, so a clean reading proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: observed ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; control also ` +
    `moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

test("TWIN BASE: the re-derived body with no defect is itself clean", { skip }, () => {
  for (const [label, c] of scen()) {
    assert.equal(diverges(makeBody({}), c), false, `${label}: the defect-free twin base diverged`);
  }
  console.log(`  TWIN BASE: clean on all ${scen().length} scenarios`);
});

for (const [label, twin, targets] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly its branches`, { skip }, () => {
    const on = scen().filter(([, c]) => diverges(twin, c)).map(([n]) => n);
    assert.ok(on.length > 0, `the ${label} twin is not caught at all`);
    assert.deepEqual(on.sort(), [...targets].sort(), `the ${label} twin's caught scenarios moved`);
    console.log(`  TEETH/${label}: caught on ${on.length}/${scen().length} — ${on.join(", ")}`);
  });
}
