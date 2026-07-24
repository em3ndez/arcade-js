// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_1f72 -- the SETUP WRAPPER at the head of the object-slot
 * scan: it gates on board phase 1 (0x6227 == 1), and on that phase presets IX=0x6700 /
 * HL=0x6980 / DE=0x0020 / B=0x0a and falls through into loc_1f83 (0x1F83). The tail is a
 * FALL-THROUGH (no push, no extra charge), modelled `return m.call(0x1f83)`; loc_1f83 (and
 * the rest of the scan loop) resolves through the routine registry to the oracle here.
 *
 * COLLAPSED to one m.step per basic block, totals preserved exactly (the routine writes no
 * hardware latch -- it only READS 0x6227 -- so nothing pins an intermediate boundary):
 *   - pre-branch  ld a(13)+dec a(4) = 17 t at 0x1F76;
 *   - NOT-phase-1 arm: + ret nz taken 11 t (m.ret) = 28 t;
 *   - phase-1 arm: ret-nz not-taken 5 + ld ix 14 + ld hl 10 + ld de 10 + ld b 7 = 46 t at
 *     0x1F83, then the 0-cost fall-through m.call(0x1f83) -> 63 t own total.
 *
 * GATE = STRICT whole-machine, byte-exact. MEASURED (the oracle's "not yet wired"
 * docstring is STALE): loc_197a's NMI cascade dispatches sub_1f72 816x over 1400 attract
 * frames (first ~frame 586). ATOMIC: 816/816 dispatches are INSIDE the NMI (io.nmiMask==0;
 * outside-NMI 0), and the NMI pushed PC never lands in [0x1F72,0x1F83] (0 in the whole
 * 0x1900-0x2FFF band; all 1394 landings in the 0x02BD-0x0372 main-loop band). An atomic,
 * total-preserving collapse is byte-exact, so the strict gate is the right license.
 *
 * BRANCH COVERAGE. Attract only ever takes the PHASE-1 arm (board == 1 at all 816
 * dispatches) -- covered by the strict whole-machine gate and the natural unit entry. The
 * NOT-phase-1 (`ret nz`) arm is never reached naturally, so it is proven from a crafted
 * identical-both-sides entry (0x6227 != 1) with its cycle TOTAL pinned.
 *
 * Jobs: STRICT whole-machine EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL + cycle-total on the natural first entry and its behavioural teeth (wrong scan
 * base); crafted NOT-phase-1 arm EQUAL (RAM+regs+pc+SP) + cycle total, with a behavioural
 * teeth (dropped ret) and a cycle teeth (dropped charge) both CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_1f72 as translated_1f72 } from "../../translated/state0.js";
import { sub_1f72 as optimized_1f72 } from "../sub_1f72.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f72;
const FRAMES_WHOLE = 1400; // past the ~f586 first dispatch; ~816 invocations (all phase-1 arm)
const FRAMES_UNIT = 650;   // the unit host must run past the first dispatch (~f586) to capture it
const RET_ADDR = 0x4d17;   // sentinel caller-return frame for the crafted NOT-phase-1 entry

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, no collapse hazard) --

test("STRICT (whole-machine): sub_1f72 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1f72]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, phase-1 arm)`);
});

test("STRICT-TEETH (cycles): a wrong pre-branch charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the pre-branch block
  // 16 t instead of 17 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(0x6227));
    m.step(0x1f76, 16); // DROPPED: the correct pre-branch total is 17 t
    if (regs.fNZ) { m.ret(11); return; }
    regs.ix = 0x6700; regs.hl = 0x6980; regs.de = 0x0020; regs.b = 0x0a;
    m.step(0x1f83, 46);
    return m.call(0x1f83);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the phase-1 arm) ----------------------------

/** Capture the pristine machine the instant sub_1f72 is first entered (via m.call, deep in
 *  the loc_197a NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1f72(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff + cycle deltas. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1f72(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    dA: a.cycles - ca0, dB: b.cycles - cb0,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_1f72 matches translated in RAM + full register file + pc + cycles", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1f72);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  assert.equal(r.dB, r.dA, `cycle total mismatch (oracle ${r.dA} t vs optimized ${r.dB} t, incl. scan subtree)`);
  assert.equal(NATURAL_ENTRY.mem.read8(0x6227), 0x01, "the natural first entry is the phase-1 arm (board==1)");
  console.log(`  EQUAL/unit: RAM + regs (incl. F, SP) + pc identical; ${r.dB} t == oracle ${r.dA} t (phase-1 arm)`);
});

test("TEETH (unit behavioural): a wrong object-scan base (IX) is CAUGHT", () => {
  // sub_1f72's job on the phase-1 arm is to aim the scan at the 0x6700 object table.
  // A twin that points IX one record too high scans the wrong records -> the loc_1f83
  // subtree diverges (final IX, and any active-record write, differ from the oracle).
  const broken_wrongBase = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(0x6227));
    m.step(0x1f76, 17);
    if (regs.fNZ) { m.ret(11); return; }
    regs.ix = 0x6720; // BUG: object table base is 0x6700
    regs.hl = 0x6980; regs.de = 0x0020; regs.b = 0x0a;
    m.step(0x1f83, 46);
    return m.call(0x1f83);
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongBase);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong scan base -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- CRAFTED NOT-PHASE-1 ARM (never reached in attract; identical-both-sides seed) ----

/** Fresh machine with a valid stack (a sentinel caller-return frame) and BOARD poked to a
 *  non-1 phase, so sub_1f72's `ret nz` fires. Applied identically to both clones. */
function seedNotPhase1(board = 0x02) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_1f72's own caller-return frame
  const entrySP = m.regs.sp;
  m.mem.write8(0x6227, board); // NOT phase 1 -> dec a != 0 -> ret nz taken
  return { m, entrySP };
}

test("BRANCH (crafted): NOT-phase-1 arm -- ret nz returns immediately, EQUAL + 28 t total", () => {
  const a = seedNotPhase1();
  const b = seedNotPhase1();
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1f72(a.m);
  optimized_1f72(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, "pc must match");
  assert.equal(a.m.regs.sp, b.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, 28, `oracle NOT-phase-1 total should be 28 t (got ${dA})`);
  assert.equal(b.m.pc, RET_ADDR, "returns to sub_1f72's caller (the sentinel)");
  assert.equal(b.m.regs.sp, b.entrySP + 2, "exactly one frame consumed by the ret");
  console.log(`  BRANCH/not-phase-1: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ${dB} t == oracle ${dA} t`);
});

test("BRANCH-TEETH (behavioural): a NOT-phase-1 twin that forgets to ret is CAUGHT", () => {
  // Drop the `ret nz` action: the twin computes the flag but never pops/returns, so pc
  // stays at 0x1F76 and SP is unmoved -- diverging from the oracle's return to the caller.
  const broken_noRet = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(0x6227));
    m.step(0x1f76, 17);
    if (regs.fNZ) { return; } // BUG: no m.ret -- pc left at 0x1F76, stack unpopped
    regs.ix = 0x6700; regs.hl = 0x6980; regs.de = 0x0020; regs.b = 0x0a;
    m.step(0x1f83, 46);
    return m.call(0x1f83);
  };
  const a = seedNotPhase1();
  const b = seedNotPhase1();
  translated_1f72(a.m);
  broken_noRet(b.m);
  const differs = a.m.pc !== b.m.pc || a.m.regs.sp !== b.m.regs.sp;
  assert.ok(differs, "gate FAILED to catch a dropped ret -- it is worthless");
  assert.equal(a.m.pc, RET_ADDR, "oracle returned to the caller");
  assert.equal(b.m.pc, 0x1f76, "broken twin is stuck at the ret nz instruction");
  console.log(`  BRANCH-TEETH/behavioural: caught -- oracle pc 0x${a.m.pc.toString(16)} vs broken 0x${b.m.pc.toString(16)}`);
});

test("BRANCH-TEETH (cycles): a dropped ret charge on the NOT-phase-1 arm is CAUGHT", () => {
  const a = seedNotPhase1();
  const b = seedNotPhase1();
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1f72(a.m);
  (function cyclebroken(m) {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(0x6227));
    m.step(0x1f76, 17);
    if (regs.fNZ) { m.ret(10); return; } // DROPPED: ret nz taken is 11 t, not 10
    regs.ix = 0x6700; regs.hl = 0x6980; regs.de = 0x0020; regs.b = 0x0a;
    m.step(0x1f83, 46);
    return m.call(0x1f83);
  })(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
