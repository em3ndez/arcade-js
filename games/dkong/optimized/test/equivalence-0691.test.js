// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_0691 (the A==0 arm of task-entry-10 entry_062a:
 * award BOTH BCD digits of 0x638C to the score, via entry_051c twice). A LEAF
 * routine -- not a dispatch target -- reached only via `m.call(0x0691)` from
 * entry_062a, and ONLY when entry_062a's dispatch payload A is zero.
 *
 * WHY THIS ROUTINE NEEDS A DRIVER. In a boot+attract run entry_062a dispatches
 * repeatedly, but ALWAYS with payload A=1 (the BCD-decrement/render arm, loc_06a8);
 * A=0 (this arm) was observed ZERO times across 2000 attract frames AND 6000 frames
 * of a driven single life. loc_0691 is a real-but-rare award path. So the harness
 * DRIVES it: a `force` override on entry_062a (identical on BOTH sides) sets A=0 on
 * the first dispatch, after a board is in play, whose 0x638C is already seeded -- and
 * entry_062a then `m.call`s 0x0691 through the REAL registry, exercising the true
 * dispatch + call path (and real NMI timing), not a hand-built entry. The force
 * delegates to the translated entry_062a on both sides, so entry_062a is identical
 * and the ONLY variable is which loc_0691 runs.
 *
 * Jobs:
 *   1. CONVERGENT (whole-machine, forced) -- base (force + oracle loc_0691) vs opt
 *      (force + the idiomatic optimized loc_0691) CONVERGE frame-by-frame (pixels +
 *      persistent non-stack state). The override must fire >=1x or EQUAL is vacuous.
 *   2. EQUAL (unit) -- from the captured real entry, translated vs optimized leave
 *      identical RAM + registers (incl. F) + pc + SP.
 *   3. DATA COVERAGE (unit) -- loc_0691 is straight-line (one control path), but its
 *      OUTPUT varies with the data it reads: the two 0x638C nibbles (award indices)
 *      and the ATTRACT gate (0x6007) that makes entry_051c skip vs award. Each is
 *      SYNTHESISED by poking those bytes identically on both sides, then diffed
 *      RAM+regs+pc+SP AND asserted to charge the oracle's exact CYCLE TOTAL.
 *   4. BRANCH-TEETH (cycles) -- a variant that drops one m.step charge yields a wrong
 *      total and is CAUGHT, proving the cycle-total assertion has teeth.
 *   5. TEETH (convergent + unit) -- convergent: a CYCLE-DROP twin forks the PRNG, a
 *      PERSISTENT divergence, CAUGHT. unit: a deliberately-broken twin whose first
 *      store to the player's score (P1_SCORE middle byte 0x60B3) lands the wrong value
 *      must be CAUGHT: NOT-EQUAL, naming 0x60B3.
 *
 * CYCLE DECISION: loc_0691 is COLLAPSED (one m.step per basic block). It is NOT atomic
 * -- reached from the MAIN LOOP (entry_062a, mask ENABLED) and it calls the
 * interruptible entry_051c, so the vblank NMI can land inside its instruction run. Per
 * the lead's collapse-sweep rule the whole-machine gate is therefore the CONVERGENT
 * one UNCONDITIONALLY (never the strict one, even where it happens to still pass); its
 * teeth is a CYCLE-DROP twin, not a value-corruption twin (which can hang a long
 * convergent run). The single-shot DATA/BRANCH-TEETH tests below are unaffected by
 * interruptibility (no frame stepping, so no NMI can land mid-call) and stay as
 * absolute cycle-total assertions. See optimized/loc_0691.js for the full decision.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_062a as translated_062a, loc_0691 as translated_0691 } from "../../translated/mainloop.js";
import { loc_0691 as optimized_0691 } from "../loc_0691.js";
import { firstStateDiff, firstRegDiff, convergentEquivalence } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { P1_SCORE, STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const rd = (n) => new Uint8Array(readFileSync(new URL(n, ROM_DIR)));
const ASSETS = ROM_PRESENT ? { gfx1: rd("gfx1.bin"), gfx2: rd("gfx2.bin"), proms: rd("proms.bin") } : {};
const DEAD_STACK = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0691;
const V638C = 0x638c; // packed two-digit BCD counter (hex -- ram.js REJECT)
const ATTRACT = 0x6007; // non-zero => entry_051c's rst-0x08 gate skips the award
const P1_SCORE_MID = P1_SCORE + 1; // 0x60B3 -- the score byte the award lands in first

// Coin + start (1P) so the game leaves attract: entry_062a then dispatches during a
// credited game (ATTRACT=0) where entry_051c actually awards the score.
const IN2 = 0x7d00;
const TAPE = [
  { port: IN2, bits: 0x80, frame: 10, dur: 6 }, // coin
  { port: IN2, bits: 0x04, frame: 30, dur: 6 }, // start 1P
];
const FORCE_AFTER = 900; // force A=0 on the first seeded entry_062a at/after this frame
const FRAMES = 1100; // the forced dispatch lands ~frame 1034; compare well past it
// loc_0691 fires only ONCE (the one seeded/forced dispatch), so a wrong cycle total's
// effect on the PRNG (0x6019/0x6018) takes longer to become visible/persistent than the
// EQUAL window above -- empirically it is still 0 diffs anywhere at 1100/1400 frames and
// clearly persistent by 1500+. TEETH_FRAMES gives that a safety margin.
const TEETH_FRAMES = 1600;

/** A fresh per-machine `force` override: on the first entry_062a dispatch at/after
 *  FORCE_AFTER whose 0x638C is seeded (!=0), set payload A=0 (and C=0, matching the
 *  dispatcher's `ld a,c`) so entry_062a routes into loc_0691, then delegate to the
 *  translated oracle. Identical on baseline and optimized -- the only variable is
 *  which loc_0691 the registry resolves. */
function makeForce() {
  let forced = false;
  return (m) => {
    const fr = m.frames ? m.frames.length : -1;
    if (!forced && fr >= FORCE_AFTER && m.mem.read8(V638C) !== 0) {
      forced = true;
      m.regs.a = 0;
      m.regs.c = 0;
    }
    return translated_062a(m);
  };
}

/**
 * Video-enabled, force-driven factory for the CONVERGENT gate. `makeForce()` is called
 * FRESH on every invocation (once for the baseline call with no overrides, once for the
 * optimized call with its wrapped override map), so each side gets its OWN independent
 * `forced` latch -- required since convergentEquivalence runs the two machines one after
 * the other, and a shared closure would have baseline's run "use up" the force before
 * optimized ever sees it. The force override itself is identical policy on both sides;
 * only the TARGET routine differs (core's convergentEquivalence wraps that for us with
 * its own invocation counter, so no manual counting is needed here).
 */
function makeMachineForcedVideo(overrides) {
  const merged = new Map([[0x062a, makeForce()]]);
  if (overrides) for (const [k, v] of overrides) merged.set(k, v);
  const m = new Machine(ROM, { ...ASSETS, overrides: merged });
  m.inputTape = TAPE.map((t) => ({ ...t }));
  m.captureVideo = true;
  return m;
}

/** Broken twin: behaviourally the optimized loc_0691 EXCEPT the first store to the
 *  player-score middle byte (0x60B3) lands the correct value XOR 0xFF. The second
 *  entry_051c award reads the corrupted byte, so the divergence persists to the final
 *  score -- the representative "wrong value to one of the routine's own output
 *  addresses" bug the gate must catch. */
function broken_0691(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === P1_SCORE_MID) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_0691(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- captured entry (driven, credited game so the award actually runs) ------------

let _entry = null;
/** Capture the pristine machine the instant loc_0691 is first entered via the forced
 *  entry_062a dispatch, in a credited game (ATTRACT=0). Cached across tests. */
function drivenEntry() {
  if (_entry) return _entry;
  const force = makeForce();
  const snap = new Map([
    [0x062a, force],
    [TARGET, (m) => { if (_entry === null) _entry = m.clone(); return translated_0691(m); }],
  ]);
  const host = new Machine(ROM, { overrides: snap });
  host.inputTape = TAPE.map((t) => ({ ...t }));
  host.runFrames(FRAMES);
  if (_entry === null) throw new Error(`0x${TARGET.toString(16)} never entered within ${FRAMES} frames`);
  return _entry;
}

/** Clone `entry`, apply identical pokes, run `fn`, report SP/PC/cycles + the machine. */
function runBranch(entry, pokes, fn) {
  const c = entry.clone();
  for (const [addr, val] of pokes) c.mem.write8(addr, val);
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Prove one synthesised data-case EQUAL across the whole contract: RAM, registers,
 *  pc, SP, and the CYCLE TOTAL (measured on both clones -- so it equals the oracle's,
 *  which is the load-bearing assertion for a per-instruction routine). */
function assertDataEqual(label, pokes) {
  const entry = drivenEntry();
  const o = runBranch(entry, pokes, translated_0691);
  const p = runBranch(entry, pokes, optimized_0691);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)} (${ram.a} vs ${ram.b})` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (${regs?.a} vs ${regs?.b})` : "");
  assert.equal(o.pc, p.pc, "pc must match the oracle");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  console.log(
    `  DATA/${label}: EQUAL -- SP 0x${p.sp.toString(16)}, pc 0x${p.pc.toString(16)}, ${p.cycles} t ` +
      `(0x638C=0x${p.machine.mem.read8(V638C).toString(16)}, ATTRACT=${p.machine.mem.read8(ATTRACT)})`,
  );
  return o.cycles;
}

// -- EQUAL --------------------------------------------------------------------

// Per the lead's rule, the whole-machine gate is the CONVERGENT one UNCONDITIONALLY.
test("CONVERGENT (whole-machine, forced): collapsed loc_0691 CONVERGES vs translated", () => {
  const r = convergentEquivalence(makeMachineForcedVideo, FRAMES, new Map([[TARGET, optimized_0691]]), {
    excludeAddr: DEAD_STACK,
  });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_0691 matches translated in RAM + registers", () => {
  const entry = drivenEntry();
  const o = runBranch(entry, [], translated_0691);
  const p = runBranch(entry, [], optimized_0691);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  assert.equal(o.cycles, p.cycles, "cycle total must match");
  console.log(`  EQUAL/unit: RAM + all registers (incl. F) + pc + SP identical (award entry, ${p.cycles} t)`);
});

// -- DATA COVERAGE (the single control path, every data case) -----------------

test("DATA (unit): 0x638C=0x50 award path (credited game, ATTRACT=0)", () => {
  assertDataEqual("award-50", []); // the captured entry as-is
});

test("DATA (unit): 0x638C=0x99 -- both nibbles non-trivial (indices 9 and 0x13)", () => {
  assertDataEqual("638C-99", [[V638C, 0x99]]);
});

test("DATA (unit): 0x638C=0x00 -- both nibbles zero (indices 0 and 0x0A)", () => {
  assertDataEqual("638C-00", [[V638C, 0x00]]);
});

test("DATA (unit): ATTRACT!=0 -- entry_051c's rst-0x08 gate skips the award", () => {
  assertDataEqual("attract-skip", [[ATTRACT, 1]]);
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = drivenEntry();
  const good = runBranch(entry, [], optimized_0691);
  // A variant identical to loc_0691 EXCEPT it drops the 0x0697 `and 0x0f` 7 t charge.
  const dropped = runBranch(entry, [], (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(V638C); m.step(0x0694, 13);
    regs.b = regs.a; m.step(0x0695, 4);
    regs.and(0x0f); /* m.step(0x0697, 7) intentionally dropped */
    m.push16(regs.bc); m.step(0x0698, 11);
    m.push16(0x069b); m.step(0x051c, 17); m.call(0x051c);
    regs.bc = m.pop16(); m.step(0x069c, 10);
    regs.a = regs.b; m.step(0x069d, 4);
    for (const next of [0x069e, 0x069f, 0x06a0, 0x06a1]) { regs.rrca(); m.step(next, 4); }
    regs.and(0x0f); m.step(0x06a3, 7);
    regs.add(0x0a); m.step(0x06a5, 7);
    m.step(0x051c, 10); return m.call(0x051c);
  });
  assert.equal(dropped.cycles, good.cycles - 7, "the dropped variant should be exactly 7 t short");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

/**
 * CYCLE-DROP twin for the CONVERGENT gate: identical memory/registers to the collapsed
 * routine, but the prologue block charge is 5 t short. A wrong total forks the main
 * loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
 * (A value-corruption twin is NOT run under the convergent gate here -- a persisting
 * corruption over a long convergent run can hang the game; that coverage stays at the
 * unit level, below.)
 */
function cyclebroken_0691(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x638c);
  regs.b = regs.a;
  regs.and(0x0f);
  m.push16(regs.bc);
  m.step(0x0698, 30); // DROPPED: the correct charge here is 35 t
  m.push16(0x069b);
  m.step(0x051c, 17);
  m.call(0x051c);
  regs.bc = m.pop16();
  regs.a = regs.b;
  regs.rrca(); regs.rrca(); regs.rrca(); regs.rrca();
  regs.and(0x0f);
  regs.add(0x0a);
  m.step(0x051c, 54);
  return m.call(0x051c);
}

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentEquivalence(makeMachineForcedVideo, TEETH_FRAMES, new Map([[TARGET, cyclebroken_0691]]), {
    excludeAddr: DEAD_STACK,
  });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong score store is CAUGHT and names 0x60B3", () => {
  const entry = drivenEntry();
  const o = runBranch(entry, [], translated_0691);
  const b = runBranch(entry, [], broken_0691);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));

  assert.ok(ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    ram.addr,
    P1_SCORE_MID,
    `expected first diff at the broken score byte 0x${P1_SCORE_MID.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
