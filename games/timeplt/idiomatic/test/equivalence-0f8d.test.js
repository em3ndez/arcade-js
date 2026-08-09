// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f8d — the image-checksum tamper trap, matched against its frozen twin at the same address.
 * GATE: no tape springs the trap (a genuine image passes the check), so entries are CRAFTED on a
 *   real machine — a seated stack of sentinel words plus the eight slot heads the trap falls through
 *   to fix up, swept across the scanline the fall-through reads. The scanline is pinned on both sides
 *   because the frozen twin's cycle accounting drifts that read across the slots and a cycle-free
 *   rewrite does not. Whole RAM, every register, sp and pc compared; teeth below.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0f8d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0f8d as candidate } from "../loc_0f8d.js";
import { loc_0f8d as oracle } from "../../translated/loc_0f8d.js";
import { multiplexSpriteSlotsSkipping as fixupPass } from "../multiplexSpriteSlotsSkipping.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0f8d;
const FALL_THROUGH = 0x0f97;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEAT = 0xa380;
// Six words seated below the seat; the trap drops four, the pass rets on the fifth, the sixth only
// feeds the over-popping twin. The fourth's low byte carries a set carry into the pass.
const WORDS = [0x1111, 0x2222, 0x3333, 0x4d4d, 0x5678, 0x9abc];
const DROPPED = 4;
const SP_LIFT = 2 * (DROPPED + 1); // four words dropped, one more the pass rets on
const RET_WORD = WORDS[DROPPED];
const SLOT_Y = [0xb411, 0xb413, 0xb415, 0xb437, 0xb439, 0xb43b, 0xb43d, 0xb43f];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? (d.reg ?? (d.addr == null ? "reg" : hex4(d.addr))) : "identical");

let base = null;
function baseState() {
  if (!base) {
    const m = makeMachine();
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the base run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, "the base run ran short");
    base = m;
  }
  return base;
}

/** A real machine with a seated stack and seeded scratch registers, then the scenario applied. */
function craft(mutate) {
  const m = baseState().clone();
  m.regs.sp = SEAT;
  for (let i = 0; i < WORDS.length; i++) {
    m.mem.write8((SEAT + i * 2) & 0xffff, WORDS[i] & 0xff);
    m.mem.write8((SEAT + i * 2 + 1) & 0xffff, (WORDS[i] >> 8) & 0xff);
  }
  m.regs.b = 0x99;
  m.regs.c = 0x88;
  m.regs.d = 0x77;
  m.regs.e = 0x66;
  m.regs.f = 0x00;
  mutate(m);
  return m;
}

const SCENARIOS = {
  quiet: (m) => { for (const y of SLOT_Y) m.mem.write8(y, 0x10); },
  armed: (m) => { for (const y of SLOT_Y) m.mem.write8(y, 0xf0); },
  mixed: (m) => { const ys = [0xf0, 0x81, 0x70, 0xc0, 0x40, 0x90, 0x7f, 0xa0]; SLOT_Y.forEach((y, i) => m.mem.write8(y, ys[i])); },
};

function pin(m, scanline) { m.io.readScanline = () => scanline & 0xff; }

/** Oracle vs candidate on clones with the scanline pinned identically: RAM, then registers, then pc. */
function unitDiff(cand, machine, scanline) {
  const a = machine.clone();
  const b = machine.clone();
  pin(a, scanline);
  pin(b, scanline);
  oracle(a);
  try {
    cand(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) return { reg: k, a: a.regs[k], b: b.regs[k] };
  if (a.pc !== b.pc) return { reg: "pc", a: a.pc, b: b.pc };
  return null;
}

function sweep(cand) {
  let caught = 0;
  for (const mutate of Object.values(SCENARIOS)) {
    for (let s = 0; s < 256; s += 8) if (unitDiff(cand, craft(mutate), s)) caught++;
  }
  return caught;
}

/** Bytes the frozen side moves at a pinned scanline — the guard against a vacuous, no-fire sweep. */
function footprint(machine, scanline) {
  const a = machine.clone();
  pin(a, scanline);
  const before = a.dumpState().slice();
  oracle(a);
  const after = a.dumpState();
  let n = 0;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) n++;
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
const brokenNoOp = () => {};
const brokenNoUnwind = (m) => { m.regs.bc = 0x02f2; return fixupPass(m); };
const brokenThreePops = (m) => { for (let i = 0; i < 3; i++) m.regs.af = m.pop16(); m.regs.bc = 0x02f2; return fixupPass(m); };
const brokenFivePops = (m) => { for (let i = 0; i < 5; i++) m.regs.af = m.pop16(); m.regs.bc = 0x02f2; return fixupPass(m); };
const brokenSkipBody = (m) => { for (let i = 0; i < DROPPED; i++) m.regs.af = m.pop16(); m.regs.bc = 0x02f2; };
const brokenNoBc = (m) => { for (let i = 0; i < DROPPED; i++) m.regs.af = m.pop16(); return fixupPass(m); };
const brokenBareFlags = (m) => { for (let i = 0; i < DROPPED; i++) m.pop16(); m.regs.bc = 0x02f2; return fixupPass(m); };
// ★ correct behaviour, but scribbles a register the trap never touches: the control for the reg check.
const brokenMovesSpareRegister = (m) => { candidate(m); m.regs.d = (m.regs.d + 1) & 0xff; };

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-unwind", brokenNoUnwind],
  ["three-pops", brokenThreePops],
  ["five-pops", brokenFivePops],
  ["skip-body", brokenSkipBody],
  ["no-bc-residue", brokenNoBc],
  ["bare-flags", brokenBareFlags],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────
test("UNREACHED: no tape springs the trap, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [FALL_THROUGH]: 0 };
    const realPass = TRANSLATED.get(FALL_THROUGH);
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [FALL_THROUGH, (mm) => { seen[FALL_THROUGH]++; return realPass(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // The zero is evidence only because the SAME run counted the pass the trap falls into.
    assert.ok(seen[FALL_THROUGH] > 0, `the ${label} run counted nothing at the pass either, so the zero is meaningless`);
    assert.equal(seen[TARGET], 0, `${label} sprang the trap — a genuine image should never fail the check`);
    console.log(`  UNREACHED: ${label} — trap ${seen[TARGET]}, control pass ${seen[FALL_THROUGH]}`);
  }
});

test("CRAFTED EQUIVALENCE: every scenario and scanline identical, and the pass really fires", { skip }, () => {
  assert.equal(sweep(candidate), 0, "a crafted state diverged");
  const prints = [];
  for (let s = 0; s < 256; s++) prints.push(footprint(craft(SCENARIOS.mixed), s));
  // ★ vacuity guard: the sweep must span quiet AND firing scanlines, or it never exercises the pass.
  assert.ok(prints.some((n) => n === 0) && prints.some((n) => n > 0), "the fall-through never fired, so the sweep is vacuous");
  console.log(`  EQUIVALENCE: 3 scenarios x 32 scanlines identical; footprint spans ${Math.min(...prints)}..${Math.max(...prints)} bytes`);
});

test("STACK UNWIND: four words dropped, the pass rets on the fifth", { skip }, () => {
  // Read off the FROZEN side and pinned, so this file's account of the unwind cannot drift.
  const m = craft(SCENARIOS.quiet);
  pin(m, 100);
  oracle(m);
  assert.equal((m.regs.sp - SEAT) & 0xffff, SP_LIFT, "the trap did not lift sp past four words plus the pass ret");
  assert.equal(m.pc, RET_WORD, "the pass did not ret on the fifth stack word");
  assert.equal(m.regs.b, 0x02, "b did not carry the trap's residue through the pass");
  console.log(`  UNWIND: sp lifted ${SP_LIFT}, pc=${hex4(m.pc)}, b=${hex4(m.regs.b)}`);
});

test("LIVE-OUT: the register check can see a stray register", { skip }, () => {
  assert.equal(sweep(candidate), 0, "the rewrite moved a register the frozen side did not");
  assert.ok(sweep(brokenMovesSpareRegister) > 0, "a twin that scribbles d is not caught, so the register check is blind");
  console.log("  LIVE-OUT: register check catches the spare-register control");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const caught = sweep(twin);
    assert.ok(caught > 0, `every crafted state PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${caught}/${3 * 32} crafted states`);
  });
}
