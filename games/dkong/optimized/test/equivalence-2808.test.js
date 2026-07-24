// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_2808 -- the collision-query wrapper in loc_197a's per-frame
 * NMI cascade (ROM 0x19B3 -> 0x2808). It sets up Mario's record as the collision subject
 * (IY=0x6200, C=(0x6205), HL=0x0407), calls the board-indexed query at 0x286f, and -- only
 * when that returns nonzero -- decrements 0x6200 (MARIO_ACTIVE). See optimized/sub_2808.js
 * for the full behaviour + collapse block.
 *
 * COLLAPSED: the four-load PROLOGUE folds to one m.step (41 t @ 0x2813); the NZ tail
 * (ret-z-not-taken + dec a + ld (0x6200),a) folds to one m.step (22 t @ 0x281c). The CALL
 * (push16 + m.step(0x286f,17) + m.call) and `and a` (4 t) stay verbatim boundaries.
 *
 * GATE = STRICT byte-exact whole-machine (the routine is ATOMIC), plus crafted-entry
 * branch coverage. MEASURED reachability/atomicity (not assumed): over 1400 attract frames
 * sub_2808 is dispatched 816x, io.nmiMask==0 at 816/816 (it runs inside the NMI, mask
 * cleared by entry_0066), and the NMI's pushed PC never lands in [0x2808,0x281C]
 * (0 landings / 1394 NMIs). Atomic + total-preserving => byte-exact whole-machine EQUAL.
 * All 816 natural dispatches take the Z arm (`ret z`, no store), so the NZ arm (dec+store)
 * is proven by a SYNTHESISED crafted entry with its cycle total pinned directly (its only
 * teeth -- no attract frame reaches it).
 *
 * Crafted entries model `call 0x2808 from loc_197a @ 0x19B3`: SP=0x6c00 with 0x19B6
 * (sub_2808's own return) on top. BOARD (0x6227) = 1 routes 0x286f -> sub_2880, whose
 * entry_2913 sweeps decide the arm:
 *   - Z  : no active record  -> all sweeps miss -> A=0 -> `ret z`, 0x6200 untouched.
 *   - NZ : active record at 0x6700 (X/Y diffs of 0 fall inside the L=7/H=4 spans) ->
 *          entry_2913 HITs, A=1, unwinds to 0x2816 -> dec a -> store 0 at 0x6200.
 * Both callees resolve to the frozen oracle through the registry (no manifest loaded), so
 * both sides run identical query logic; only sub_2808's own wrapper is under test. A
 * sentinel 0x6200=0xEE is poked IDENTICALLY on both sides so the NZ store is observable.
 *
 * Jobs: STRICT whole-machine EQUAL (+ invocation proof) and its cycle teeth; per-arm
 * crafted EQUAL (RAM + full register file + pc + SP) with the exact oracle cycle TOTAL;
 * and a dropped-charge cycle twin + a wrong-arm behavioural twin, both CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2808 as translated_2808 } from "../../translated/state0.js";
import { sub_2808 as optimized_2808 } from "../sub_2808.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2808;
const FRAMES_WHOLE = 1400; // past the first dispatch; ~816 invocations (all Z arm)
const RET_ADDR = 0x19b6; // sub_2808's own return address (into loc_197a)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) --------------

test("STRICT (whole-machine): sub_2808 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_2808]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic)`);
});

test("STRICT-TEETH (cycles): a wrong prologue charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the prologue 40 t
  // instead of 41 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.iy = 0x6200;
    regs.a = mem.read8(0x6205);
    regs.c = regs.a;
    regs.hl = 0x0407;
    m.step(0x2813, 40); // DROPPED: the correct prologue total is 41 t
    m.push16(0x2816);
    m.step(0x286f, 17);
    m.call(0x286f);
    regs.and(regs.a);
    m.step(0x2817, 4);
    if (regs.fZ) { m.ret(11); return; }
    regs.a = regs.dec8(regs.a);
    mem.write8(0x6200, regs.a);
    m.step(0x281c, 22);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- CRAFTED-ENTRY FULL-BRANCH COVERAGE (both arms; identical-both-sides seed) --

/**
 * Fresh machine seeded so `call 0x2808 from 0x19B3` is modelled and the game's OWN
 * callees (sub_286f -> sub_2880 -> entry_2913, resolved to the oracle) drive the chosen
 * arm. `hit` plants an active record at 0x6700 so entry_2913 HITs (NZ arm). The 0x6200
 * sentinel is poked identically so the NZ store is observable. Returns { m, entrySP }.
 */
function seed({ hit }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_2808's own caller-return frame (into loc_197a)
  const entrySP = m.regs.sp;
  m.mem.write8(0x6227, 0x01); // BOARD = 1 -> 0x286f dispatches to sub_2880
  m.mem.write8(0x6200, 0xee); // sentinel: the NZ store overwrites it, the Z arm does not
  if (hit) m.mem.write8(0x6700, 0x01); // record 0 active -> entry_2913 HIT (X/Y diff 0 in span)
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total. */
function assertArm(label, hit, expectMem6200) {
  const a = seed({ hit });
  const b = seed({ hit });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2808(a.m);
  optimized_2808(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  // Structural checks: the arm did what it should, and the stack balanced.
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return to sub_2808's caller (0x19B6)`);
  assert.equal(b.m.regs.sp, b.entrySP + 2, `${label}: exactly one frame consumed`);
  assert.equal(
    b.m.mem.read8(0x6200), expectMem6200,
    `${label}: 0x6200 should be 0x${expectMem6200.toString(16)} (Z arm leaves the sentinel, NZ stores A-1)`,
  );
  console.log(
    `  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
      `0x6200=0x${b.m.mem.read8(0x6200).toString(16)}, ${dB} t == oracle ${dA} t`,
  );
}

test("BRANCH (crafted): Z arm -- query finds nothing, `ret z`, 0x6200 untouched", () => {
  assertArm("z-retz", false, 0xee); // sentinel survives: no store
});

test("BRANCH (crafted): NZ arm -- entry_2913 HIT, A=1 -> dec a -> store 0 at 0x6200", () => {
  assertArm("nz-store", true, 0x00); // A=1 decremented to 0, then stored
});

// -- TEETH --------------------------------------------------------------------

test("BRANCH-TEETH (cycles): a dropped NZ-tail charge yields a wrong total and is CAUGHT", () => {
  const a = seed({ hit: true });
  const b = seed({ hit: true });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2808(a.m);
  // Same behaviour as optimized, but the collapsed NZ tail is 1 t short.
  (function cyclebroken(m) {
    const { regs, mem } = m;
    regs.iy = 0x6200;
    regs.a = mem.read8(0x6205);
    regs.c = regs.a;
    regs.hl = 0x0407;
    m.step(0x2813, 41);
    m.push16(0x2816);
    m.step(0x286f, 17);
    m.call(0x286f);
    regs.and(regs.a);
    m.step(0x2817, 4);
    if (regs.fZ) { m.ret(11); return; }
    regs.a = regs.dec8(regs.a);
    mem.write8(0x6200, regs.a);
    m.step(0x281c, 21); // DROPPED: the correct NZ tail total is 22 t
    m.ret();
  })(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (behavioural): a twin that always `ret`s (skips the store) is CAUGHT on the NZ arm", () => {
  const a = seed({ hit: true });
  const b = seed({ hit: true });
  translated_2808(a.m);
  // BUG: treats every result as Z (returns without the dec/store) -- must fork RAM.
  (function broken_alwaysRetZ(m) {
    const { regs, mem } = m;
    regs.iy = 0x6200;
    regs.a = mem.read8(0x6205);
    regs.c = regs.a;
    regs.hl = 0x0407;
    m.step(0x2813, 41);
    m.push16(0x2816);
    m.step(0x286f, 17);
    m.call(0x286f);
    regs.and(regs.a);
    m.step(0x2817, 11); // BUG: unconditional ret z
    m.ret(); // never stores 0x6200
  })(b.m);
  const differs =
    a.m.regs.a !== b.m.regs.a ||
    a.m.mem.read8(0x6200) !== b.m.mem.read8(0x6200) ||
    firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off)) != null;
  assert.ok(differs, "gate FAILED to catch a skipped store -- it is worthless");
  assert.equal(a.m.mem.read8(0x6200), 0x00, "oracle stored 0 at 0x6200 on the hit arm");
  assert.equal(b.m.mem.read8(0x6200), 0xee, "broken twin left the sentinel (never stored)");
  console.log(
    `  BRANCH-TEETH/behavioural: caught -- oracle 0x6200=0x${a.m.mem.read8(0x6200).toString(16)} ` +
      `vs broken 0x${b.m.mem.read8(0x6200).toString(16)}`,
  );
});
