// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterVblankInterrupt — memory-equivalent to the frozen oracle at ROM 0x0066, the interrupt vector, in the
 * DISSOLVED form the idiomatic engine fires (see _vblankService.js for the contract every gate in this
 * family shares: memory outside the oracle's measured dead stack scratch, every device, SP).
 *
 * The frozen vector is `jp 0x00D8`, and the interrupt it serves arrived by a pushed resume word and leaves
 * by the `ret` at the end of the close. The idiomatic engine does neither: machine.js fireNmi, when the
 * engine sets `idiomaticNmi`, counts the interrupt and calls this rewrite directly — no push, no vector,
 * no seam — and the rewrite runs the whole service and comes back in plain JS. So:
 *
 *   1. REACH — the vector is dispatched once per interrupt under both tapes, cross-checked against the
 *      machine's own interrupt counter, with the handler at 0x00D8 as the positive control.
 *   2. FULL — every captured entry of both tapes: the whole service run both ways, memory outside the
 *      dead stack window and every device identical; called directly the rewrite leaves SP where it
 *      found it; placed through the game's dispatch seam it lands SP and pc where the oracle's `ret` does.
 *   3. FIRE — the engine itself: with `idiomaticNmi` set, fireNmi pushes nothing (SP and the would-be
 *      slot untouched), bumps the interrupt counter, and leaves the oracle's memory; with it clear (the
 *      cycle-driven engine) the same call still pushes the resume word and vectors through the frozen
 *      path — the control that the branch, not the machine, is what changed.
 *   4. DEVICES — the device comparison is shown able to see a write the service does not make.
 *   5. TEETH — three twins, each caught on the corpus.
 *
 * HOLE: pc and cycles are not compared on a direct call — the frozen path steps both and the rewrite steps
 * neither, the ordinary memory-equivalence drop; the placed arm compares pc where it is meaningful.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0066.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import {
  captureAt, dissolvedDiff, runOracle, deviceSignature, TAPES, hex4,
} from "./_vblankService.js";
import { enterVblankInterrupt } from "../enterVblankInterrupt.js";
import { loc_0066 as oracle } from "../../translated/loc_0066.js";
import { buildRoutines } from "../../routines.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x0066;
const HANDLER = 0x00d8;
const WATCHDOG = 0xc200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CORPUS_ENTRIES = 120;
const FIRE_ENTRIES = 40;

const corpusOf = (label, opts) => captureAt(TARGET, label, opts, { limit: CORPUS_ENTRIES });
const diff = (cand, e) => dissolvedDiff(oracle, cand, e, { placedAt: TARGET });

// ── twins ────────────────────────────────────────────────────────────────────────────────

const TWINS = [
  ["no-op", () => {}],
  ["double-service", (m) => { enterVblankInterrupt(m); enterVblankInterrupt(m); }],
  ["own-return", (m) => { enterVblankInterrupt(m); m.ret(); }],
];

// ── the gate ─────────────────────────────────────────────────────────────────────────────

test("REACH: the interrupt really lands here, cross-checked and with a positive control", { skip }, () => {
  for (const [label, opts] of TAPES) {
    const real = buildRoutines();
    const counts = { [TARGET]: 0, [HANDLER]: 0 };
    const overrides = new Map();
    for (const addr of [TARGET, HANDLER]) {
      const body = real.get(addr);
      overrides.set(addr, (mm, ...args) => {
        counts[addr]++;
        return body(mm, ...args);
      });
    }
    const m = makeMachine(overrides, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} reach run stopped early: ${m.stoppedBy}`);
    assert.ok(counts[HANDLER] > 0, `the ${label} tap counted nothing for the handler either`);
    assert.ok(counts[TARGET] > 0, `vacuous: the ${label} tape never reached this entry`);
    assert.equal(counts[TARGET], m.nmiCount,
      `${label}: this entry fired ${counts[TARGET]} times but the machine counted ${m.nmiCount} interrupts`);
    console.log(`  REACH: ${label} — ${counts[TARGET]} dispatches (interrupts ${m.nmiCount}, handler ${counts[HANDLER]})`);
  }
});

test("FULL: every captured entry, the whole service both ways", { skip }, () => {
  let total = 0;
  for (const [label, opts] of TAPES) {
    const entries = corpusOf(label, opts);
    assert.ok(entries.length > 0, `vacuous: the ${label} tape never reached the vector`);
    for (const e of entries) {
      const d = diff(enterVblankInterrupt, e);
      assert.equal(d, null, `${label}: ${d}`);
    }
    total += entries.length;
  }
  console.log(`  FULL: ${total} entries identical; SP unmoved directly, level with the oracle when placed`);
});

test("FIRE: the idiomatic engine fires the rewrite directly; the cycle engine still pushes and vectors", { skip }, () => {
  const entries = corpusOf("coin-start", {}).slice(0, FIRE_ENTRIES);
  for (const e of entries) {
    // The captured entry is the moment AFTER acceptance: the resume word sits at SP. Before
    // acceptance SP was two higher and the word was what the interrupted code was about to run.
    const seat = e.regs.sp;
    const resume = e.mem.read16(seat);
    const o = runOracle(oracle, e);
    const dead = (addr) => addr != null && addr >= o.low && addr < seat;

    const direct = e.clone();
    direct.regs.sp = (seat + 2) & 0xffff;
    direct.idiomaticNmi = true;
    const before = direct.nmiCount;
    direct.fireNmi();
    assert.equal(direct.regs.sp, (seat + 2) & 0xffff, "the direct interrupt moved SP");
    assert.equal(direct.mem.read16(seat), resume, "the direct interrupt wrote the would-be resume slot");
    assert.equal(direct.nmiCount, before + 1, "the direct interrupt was not counted");
    const d = firstStateDiff(o.m.dumpState(), direct.dumpState(), (off) => o.m.stateOffsetToAddr(off), dead);
    assert.equal(d, null, d && `direct fire diverged at ${hex4(d.addr ?? 0)}: frozen=${d.a} fired=${d.b}`);
    assert.equal(deviceSignature(direct), deviceSignature(o.m), "the direct interrupt's devices differ");

    // The control: the same machine with the flag clear takes the frozen push-and-vector path.
    const vectored = e.clone();
    vectored.regs.sp = (seat + 2) & 0xffff;
    vectored.mem.write16(seat, 0); // prove the push, not the capture, puts the resume word back
    vectored.idiomaticNmi = false;
    vectored.pc = resume;
    vectored.pcKnown = true;
    vectored.fireNmi();
    assert.equal(vectored.regs.sp, (seat + 2) & 0xffff, "the vectored interrupt did not come back level");
    assert.equal(vectored.mem.read16(seat), resume, "the vectored interrupt did not push the resume word");
    assert.equal(vectored.pc, resume, "the vectored interrupt did not return to the resume word");
  }
  console.log(`  FIRE: ${entries.length} entries — direct: no push, SP level, counted, memory = oracle; vectored: pushes, returns`);
});

test("DEVICES: the device comparison is shown able to see a write the service does not make", { skip }, () => {
  const e = corpusOf("coin-start", {})[0];
  const clean = diff(enterVblankInterrupt, e);
  const kicked = diff((m) => { enterVblankInterrupt(m); m.mem.write8(WATCHDOG, 0); }, e);
  assert.equal(clean, null, clean);
  assert.notEqual(kicked, null, "a twin that kicks the watchdog once more reads the same as the rewrite");
  console.log(`  DEVICES: the extra-kick twin reads ${kicked}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const pool = corpusOf("coin-start", {});
    const caught = pool.filter((e) => diff(twin, e) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught}/${pool.length}`);
    assert.equal(caught, pool.length, `the ${label} twin escaped a captured entry`);
  });
}
