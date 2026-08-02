// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for advanceToNextObject (ROM 0x2E78) — the per-object scan's cursor advance.
 *
 * loc_2e78 is a LEAF (0 callees) and, unusually, its entire observable effect is on
 * REGISTERS, not memory: it advances the object-record scan cursor by 16, advances the
 * paired sprite/animation-record cursor by 4, leaves 4 behind as the step amount, and
 * touches no RAM and no other live register. So the memory-equivalence contract here is:
 *   • RAM − nothing (the routine writes NO memory; a spurious write must be caught),
 *   • SP (unchanged — the routine touches no stack),
 *   • and the routine's declared REGISTER live-out.
 *
 * DECLARED LIVE-OUT — what the still-translated scan loop (loc_2e04) actually consumes
 * after this tail: the two advanced cursors (ix, iy) it re-reads on the next object, the
 * remaining-object count (b) it feeds to its djnz, and — reproduced conservatively — the
 * leftover step (de). The oracle's residual arithmetic flags and its scratch a/c/h/l are
 * DEAD (the next object's processing overwrites them before any test), and its landing pc
 * is dead too (the loop drives control flow through its own counter, not this fragment's
 * address), so none of those is compared. de is loop-scratch (the loop reloads its own
 * step before the next advance) but is reproduced and compared so no liveness guess is
 * needed — if it were ever read, the gate would already be pinning it.
 *
 * The effect is a PURE FUNCTION of (ix, iy): independent of RAM, of every other register,
 * and of the incoming de — verified below — and the two cursor maps are independent of
 * each other. That factorisation makes an EXHAUSTIVE gate available:
 *
 *   1. EQUAL (exhaustive) — sweep the IX arm over ALL 65536 cursor values (iy held at the
 *      real sprite-record base) and the IY arm over ALL 65536 values (ix held at the real
 *      object-record base); each run must match the oracle on RAM + SP + the live-out.
 *      Both 16-bit wraps (0xFFFF→…, 0xFFFC→…) are inside the sweep. Together with the
 *      cross-coupling rule-outs below this is a proof of the whole (ix, iy) space, because
 *      ix' depends only on ix and iy' only on iy.
 *   2. EQUAL (grid + random) — a cross-product over the EXACT in-game cursor sequence
 *      (ix = 0x6500+16k, iy = 0x6980+4j) and a large random combined-pair sample, to rule
 *      out any cross term between the two arms.
 *   3. EQUAL (independence) — hold (ix, iy) fixed and vary the incoming de, b, a/c/h/l, and
 *      a RAM byte: the output is unchanged, proving the routine reads only the two cursors.
 *   4. REALISM (captured) — attract only ever takes loc_2e04's loop-SKIP arm (board 1;
 *      the loop needs board 3), so 0x2e78 never dispatches in plain attract. Steer the
 *      game's OWN board/enable gates into the full 10-object pass (the sanctioned
 *      identical-both-sides poke), run the REAL loc_2e04, and hook 0x2e78 to capture the
 *      10 real dispatches — the true in-game cursor sequence — then replay oracle vs
 *      candidate on each.
 *   5. TEETH — six deliberately-broken twins (wrong IX stride, wrong IY stride, dropped IY
 *      advance, wrong leftover step, clobbered loop counter, spurious RAM write); the SAME
 *      exhaustive sweep must catch every one, or the gate proves nothing.
 *
 * No STACK_SCRATCH exclusion is needed: the oracle performs no push/pop/ret, so there is no
 * dead stack churn to mask — the RAM diff is over the whole dump.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2e78.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2e78 as oracle } from "../../translated/loc_2e78.js";
import { advanceToNextObject } from "../advanceToNextObject.js";
import { loc_2e04 } from "../../translated/loc_2e04.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const OBJ_BASE = 0x6500;  // real object-record scan base (the IX cursor)
const SPR_BASE = 0x6980;  // real sprite/mirror-record scan base (the IY cursor)
const LOOP_COUNT = 0x0a;  // remaining-object count the loop holds while this tail runs
const JUNK_DE = 0x1234;   // nonzero incoming step: a twin that forgets to set it is caught
const SAFE_SP = 0x6bf8;   // work-RAM stack; the routine never touches it, kept well-defined

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// Reset the compared inputs on a reused machine (frame machinery already neutralised by
// clone(); re-asserted so the oracle's internal stepping can never fire an NMI/frame).
function setInput(m, ix, iy) {
  m.regs.ix = ix;
  m.regs.iy = iy;
  m.regs.b = LOOP_COUNT;
  m.regs.de = JUNK_DE;
  m.regs.sp = SAFE_SP;
  m.nextNmi = Infinity;
  m.nextBoundary = Infinity;
}

// The register live-out contract (what loc_2e04 consumes) + de (conservative). null | string.
function regLiveOutDiff(o, c) {
  if (o.regs.ix !== c.regs.ix) return `ix oracle=${hx16(o.regs.ix)} cand=${hx16(c.regs.ix)}`;
  if (o.regs.iy !== c.regs.iy) return `iy oracle=${hx16(o.regs.iy)} cand=${hx16(c.regs.iy)}`;
  if (o.regs.b !== c.regs.b) return `b oracle=${hx(o.regs.b)} cand=${hx(c.regs.b)}`;
  if (o.regs.de !== c.regs.de) return `de oracle=${hx16(o.regs.de)} cand=${hx16(c.regs.de)}`;
  return null;
}

// Full contract: RAM (whole dump — the routine writes none) + SP (unchanged) + live-out.
function contractDiff(o, c) {
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) return `RAM@0x${(ram.addr ?? 0).toString(16)} oracle=${ram.a} cand=${ram.b}`;
  if (o.regs.sp !== c.regs.sp) return `SP oracle=${hx16(o.regs.sp)} cand=${hx16(c.regs.sp)}`;
  return regLiveOutDiff(o, c);
}

// Exhaustive sweep of BOTH 16-bit cursor arms, reusing two machines (fast: the routine
// writes no RAM, so the reused machines stay clean and only their registers are reset).
// Returns the first contract mismatch (or null) and the number of combos compared.
function sweepBothArms(base, candidate) {
  const om = base.clone();
  const cm = base.clone();
  let count = 0;

  // IX arm: every 16-bit object-record cursor value, sprite cursor at its real base.
  for (let ix = 0; ix < 65536; ix++) {
    setInput(om, ix, SPR_BASE);
    setInput(cm, ix, SPR_BASE);
    oracle(om);
    candidate(cm);
    count++;
    const d = contractDiff(om, cm);
    if (d) return { mismatch: `IX arm ix=${hx16(ix)}: ${d}`, count };
  }

  // IY arm: every 16-bit sprite-record cursor value, object cursor at its real base.
  for (let iy = 0; iy < 65536; iy++) {
    setInput(om, OBJ_BASE, iy);
    setInput(cm, OBJ_BASE, iy);
    oracle(om);
    candidate(cm);
    count++;
    const d = contractDiff(om, cm);
    if (d) return { mismatch: `IY arm iy=${hx16(iy)}: ${d}`, count };
  }

  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): advanceToNextObject == oracle over both full 16-bit cursor arms", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweepBothArms(base, advanceToNextObject);
  assert.equal(mismatch, null, mismatch || "");
  assert.equal(count, 65536 * 2, "must have swept both full 16-bit cursor arms");
  console.log(`  EQUAL/exhaustive: ${count} cursor values — RAM + SP + live-out identical to the oracle`);
});

// -- 2. EQUAL (grid + random combined pairs) ----------------------------------

test("EQUAL (grid): the exact in-game cursor sequence, cross-producted, matches the oracle", () => {
  const base = new Machine(ROM).clone();
  let count = 0;
  for (let k = 0; k < 10; k++) {
    for (let j = 0; j < 10; j++) {
      const ix = (OBJ_BASE + 16 * k) & 0xffff;
      const iy = (SPR_BASE + 4 * j) & 0xffff;
      const om = base.clone();
      const cm = base.clone();
      setInput(om, ix, iy);
      setInput(cm, ix, iy);
      oracle(om);
      advanceToNextObject(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `grid ix=${hx16(ix)} iy=${hx16(iy)}: ${d}` : "");
      count++;
    }
  }
  assert.equal(count, 100);
  console.log(`  EQUAL/grid: ${count} in-game (ix,iy) combos identical to the oracle`);
});

test("EQUAL (random pairs): 20000 random combined (ix,iy) pairs match — no cross term", () => {
  const base = new Machine(ROM).clone();
  const om = base.clone();
  const cm = base.clone();
  let seed = 0x2e78abcd >>> 0; // deterministic LCG for reproducibility
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  let count = 0;
  for (let i = 0; i < 20000; i++) {
    const ix = next() & 0xffff;
    const iy = next() & 0xffff;
    setInput(om, ix, iy);
    setInput(cm, ix, iy);
    oracle(om);
    advanceToNextObject(cm);
    const d = contractDiff(om, cm);
    assert.equal(d, null, d ? `random ix=${hx16(ix)} iy=${hx16(iy)}: ${d}` : "");
    count++;
  }
  console.log(`  EQUAL/random: ${count} random (ix,iy) pairs identical to the oracle`);
});

// -- 3. EQUAL (input independence) --------------------------------------------

test("EQUAL (independence): output depends ONLY on the two cursors, not de/b/scratch/RAM", () => {
  const base = new Machine(ROM).clone();
  const IX = OBJ_BASE, IY = SPR_BASE;
  let count = 0;
  for (const de of [0x0000, 0x0004, 0x1234, 0xffff]) {
    for (const b of [0x01, 0x0a, 0xff]) {
      const om = base.clone();
      const cm = base.clone();
      // Same varied "should be ignored" inputs on both sides.
      for (const m of [om, cm]) {
        m.regs.ix = IX; m.regs.iy = IY; m.regs.de = de; m.regs.b = b;
        m.regs.a = 0x11; m.regs.c = 0x33; m.regs.h = 0x44; m.regs.l = 0x55;
        m.regs.sp = SAFE_SP;
        m.mem.write8(0x6100, 0xa5); // a work-RAM byte the routine must not read or write
        m.nextNmi = Infinity; m.nextBoundary = Infinity;
      }
      oracle(om);
      advanceToNextObject(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `de=${hx16(de)} b=${hx(b)}: ${d}` : "");
      // And the output is the expected constant transform regardless of the ignored inputs.
      assert.equal(cm.regs.ix, (IX + 16) & 0xffff, "ix must advance by 16 regardless of de/b");
      assert.equal(cm.regs.iy, (IY + 4) & 0xffff, "iy must advance by 4 regardless of de/b");
      assert.equal(cm.regs.de, 4, "leftover step must be 4 regardless of incoming de");
      assert.equal(cm.regs.b, b, "loop counter must be preserved");
      count++;
    }
  }
  console.log(`  EQUAL/independence: ${count} (de,b,scratch,RAM) variations — output unchanged`);
});

// -- 4. REALISM (real captured dispatches) ------------------------------------

// Steer the game's own gates into loc_2e04's full 10-object loop and hook 0x2e78 to
// capture the real in-game dispatch states (attract never reaches the loop). Returns the
// captured entry clones — the true cursor sequence the scan produces in play.
function captureRealDispatches() {
  const host = new Machine(ROM);
  host.runFrames(700); // realistic work RAM (0x2e78 does not dispatch in attract, so no captures yet)
  const m = host.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d17); // sentinel caller-return for loc_2e04
  m.mem.write8(0x6227, 3); // board = 3   -> rst 0x30 (A=0x04) passes
  m.mem.write8(0x6200, 1); // enable bit0 -> rst 0x10 passes -> full 10-object loop
  const caps = [];
  const hook = (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  };
  m.overrides.set(0x2e78, hook);
  m.routines.set(0x2e78, hook);
  loc_2e04(m);
  return caps;
}

test("REALISM: real captured 0x2e78 dispatches — advanceToNextObject matches the oracle", () => {
  const caps = captureRealDispatches();
  assert.equal(caps.length, 10, "the full-loop loc_2e04 should dispatch 0x2e78 once per object (10)");

  caps.forEach((cap, i) => {
    // The captured cursors are the exact in-game scan sequence.
    assert.equal(cap.regs.ix, (OBJ_BASE + 16 * i) & 0xffff, `dispatch ${i}: unexpected ix`);
    assert.equal(cap.regs.iy, (SPR_BASE + 4 * i) & 0xffff, `dispatch ${i}: unexpected iy`);
    const o = cap.clone();
    const c = cap.clone();
    oracle(o);
    advanceToNextObject(c);
    const d = contractDiff(o, c);
    assert.equal(d, null, d ? `real dispatch ${i} (ix=${hx16(cap.regs.ix)}): ${d}` : "");
  });
  console.log(`  REALISM: ${caps.length} real full-loop 0x2e78 dispatches — RAM + SP + live-out == oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) wrong object-record stride (15 instead of 16). */
function brokenIxStride(m) { const { regs } = m; regs.ix = regs.ix + 15; regs.iy = regs.iy + 4; regs.de = 4; }
/** (b) wrong sprite-record stride (8 instead of 4). */
function brokenIyStride(m) { const { regs } = m; regs.ix = regs.ix + 16; regs.iy = regs.iy + 8; regs.de = 4; }
/** (c) drops the sprite-cursor advance entirely. */
function brokenDroppedIy(m) { const { regs } = m; regs.ix = regs.ix + 16; regs.de = 4; }
/** (d) wrong leftover step value (5 instead of 4). */
function brokenLeftoverStep(m) { const { regs } = m; regs.ix = regs.ix + 16; regs.iy = regs.iy + 4; regs.de = 5; }
/** (e) clobbers the remaining-object count the loop's djnz consumes. */
function brokenClobberCounter(m) { const { regs } = m; regs.ix = regs.ix + 16; regs.iy = regs.iy + 4; regs.de = 4; regs.b = 0; }
/** (f) writes a byte of work RAM the oracle never touches. */
function brokenRamWrite(m) { const { regs, mem } = m; regs.ix = regs.ix + 16; regs.iy = regs.iy + 4; regs.de = 4; mem.write8(0x6100, 0xff); }

test("TEETH: the same exhaustive sweep CATCHES every broken twin", () => {
  const base = new Machine(ROM).clone();
  const twins = [
    ["wrong IX stride", brokenIxStride, "ix"],
    ["wrong IY stride", brokenIyStride, "iy"],
    ["dropped IY advance", brokenDroppedIy, "iy"],
    ["wrong leftover step", brokenLeftoverStep, "de"],
    ["clobbered loop counter", brokenClobberCounter, "b"],
    ["spurious RAM write", brokenRamWrite, "RAM"],
  ];
  for (const [name, twin, surface] of twins) {
    const { mismatch } = sweepBothArms(base, twin);
    assert.notEqual(mismatch, null, `the sweep FAILED to catch "${name}" — the gate is worthless`);
    assert.ok(
      mismatch.includes(surface),
      `"${name}" should be caught on ${surface}, got: ${mismatch}`,
    );
    console.log(`  TEETH/${name}: caught — ${mismatch}`);
  }
});
