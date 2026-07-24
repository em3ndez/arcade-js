// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_0347 (ROM 0x0347): a pure LEAF that returns
 * one of two player-marker VRAM column bases in HL, keyed on A's zero-ness. Its
 * only caller, sub_0315, passes CURRENT_PLAYER (0x600D) and then draws the blinking
 * "1UP"/"2UP" active-player marker down the selected column.
 *
 * sub_0347 is reached ONLY via `m.call(0x0347)` from sub_0315, which mainLoop runs
 * on every pass -- so during the vblank spin it is re-invoked ~140x/frame, and it
 * dispatches from a plain boot/attract run (no coin needed). The harness installs
 * the snapshot/override at CONSTRUCTION, so it reaches this leaf through m.call.
 *
 * COLLAPSED (one m.step per basic block); the whole-machine gate is the CONVERGENT
 * one, not strict. sub_0347 is reached from sub_0315 in the INTERRUPTIBLE main-loop
 * band, and the vblank NMI is MEASURED to land inside it on real runs -- an earlier
 * attempt at this collapse, gated with the STRICT whole-machine comparison,
 * diverged in dead stack RAM (excluded by the convergent gate, not the strict one).
 * "Atomic" is a property of the SCENARIO you happened to test, not of the routine,
 * so the strict gate would be a brittle false guarantee here; the convergent gate
 * still catches everything that actually matters (a wrong cycle total, a wrong
 * memory op, a forked PRNG) as a PERSISTENT divergence.
 *
 * Jobs:
 *   1. CONVERGENT (whole-machine) -- optimized sub_0347 CONVERGES against its oracle
 *      over the attract run (pixels + persistent non-stack state). The override
 *      must actually fire (asserted).
 *   1b. EQUAL (unit) -- RAM + full register file (incl. F) + pc identical.
 *   2. BRANCH COVERAGE -- both data-dependent arms proven EQUAL from the captured
 *      entry: the Z arm (A == 0 -> HL = 0x7740) is the ONLY arm the natural run
 *      takes (a 1-player game holds CURRENT_PLAYER == 0), so the NZ arm (A != 0 ->
 *      HL = 0x74E0) is SYNTHESISED by presetting A. Each arm also pins its cycle
 *      TOTAL to the oracle's (25 t Z / 39 t NZ) with a non-vacuous wrong-total check.
 *   3. TEETH (unit) -- a deliberately-wrong return (HL forced to the OTHER player's
 *      column) is CAUGHT as a REGISTER divergence (this leaf writes no RAM, so its
 *      only output is HL/F -- the unit teeth necessarily name a register, not a RAM
 *      address).
 *   4. TEETH (convergent) -- a cycle-broken twin (Block A's charge 5 t short) forks
 *      the main loop's spin count (0x6019, the PRNG entropy): a PERSISTENT
 *      divergence, CAUGHT. (The value-corruption twin above stays at the fast unit
 *      level -- a long convergent run with it could hang on a broken game invariant.)
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0347 as translated_0347 } from "../../translated/mainloop.js";
import { sub_0347 as optimized_0347 } from "../sub_0347.js";
import { Machine } from "../../machine.js";
import { unitEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0347;
const FRAMES = 30; // sub_0347 fires many times/frame from boot; 30 covers it amply

const VRAM_P1_MARK = 0x7740; // Z arm (player 1)
const VRAM_P2_MARK = 0x74e0; // NZ arm (player 2)

// Deliberately-broken twin: run the real optimized routine, then force HL to the
// OTHER player's column. On the Z arm (the only arm the natural run takes) the
// correct HL is 0x7740, so 0x74E0 is a genuinely wrong return -- the representative
// "routine returned the wrong pointer" bug. Downstream, sub_0315 then writes the
// marker tiles to the wrong VRAM cells, so the whole-machine gate sees a VRAM diff;
// the unit gate sees the wrong HL directly.
function broken_0347(m) {
  optimized_0347(m);
  m.regs.hl = VRAM_P2_MARK;
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but Block A's charge is 5 t short (14 -> 9). Block A runs on
// EVERY invocation (unconditional prologue), so the drop always fires. A wrong total
// forks the main loop's spin count (0x6019, the PRNG entropy) -- a PERSISTENT
// divergence, never a heal. This is the teeth for the collapse's load-bearing
// invariant (total-cycle preservation); a value-corruption twin would break a game
// invariant and could hang a long convergent run, so the value teeth stays at the
// fast unit level (job 3 above).
function cyclebroken_0347(m) {
  const { regs } = m;
  regs.hl = VRAM_P1_MARK;
  regs.and(regs.a);
  m.step(0x034b, 9); // DROPPED: the correct charge here is 14 t
  if (regs.fZ) { m.ret(11); return; }
  regs.hl = VRAM_P2_MARK;
  m.step(0x034f, 15);
  m.ret();
}

// -- pristine-entry capture (for the branch-coverage checks) ------------------

/** Capture the machine the instant sub_0347 is FIRST entered (early, during boot;
 *  A == 0, the Z arm). Plain boot -- no tape/poke needed. */
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0347(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("sub_0347 never entered within the run window");
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Clone the entry, preset A, run `fn`, return { m, cycles }. */
function runArm(fn, a) {
  const c = ENTRY.clone();
  c.regs.a = a;
  const c0 = c.cycles;
  fn(c);
  return { m: c, cycles: c.cycles - c0 };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_0347 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0347]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized sub_0347 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0347, optimized_0347, { maxFrames: FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- BRANCH COVERAGE (both arms EQUAL, each cycle total pinned) ----------------

test("BRANCH COVERAGE: Z arm (A==0 -> 0x7740) and NZ arm (A!=0 -> 0x74E0) both EQUAL", () => {
  const arms = [
    { name: "Z (player 1)", a: 0x00, hl: VRAM_P1_MARK, total: 25 },
    { name: "NZ (player 2)", a: 0x05, hl: VRAM_P2_MARK, total: 39 }, // SYNTHESISED
  ];
  for (const arm of arms) {
    const o = runArm(translated_0347, arm.a);
    const b = runArm(optimized_0347, arm.a);

    const ram = firstStateDiff(o.m.dumpState(), b.m.dumpState(), (off) => o.m.stateOffsetToAddr(off));
    const regs = firstRegDiff(o.m.regs, b.m.regs);
    assert.equal(ram, null, ram ? `${arm.name}: RAM diff at 0x${ram.addr.toString(16)}` : "");
    assert.equal(regs, null, regs ? `${arm.name}: reg diff at ${regs.reg} (t ${regs?.a} vs o ${regs?.b})` : "");
    assert.equal(o.m.pc, b.m.pc, `${arm.name}: pc must match`);

    // Both sides must actually have taken this arm (HL == expected column).
    assert.equal(o.m.regs.hl, arm.hl, `${arm.name}: oracle HL wrong`);
    assert.equal(b.m.regs.hl, arm.hl, `${arm.name}: optimized HL wrong`);

    // Cycle total pinned to the oracle's, and the assertion has teeth.
    assert.equal(b.cycles, o.cycles, `${arm.name}: cycle total drifted (o ${o.cycles} vs opt ${b.cycles})`);
    assert.equal(o.cycles, arm.total, `${arm.name}: oracle total expected ${arm.total}t, got ${o.cycles}`);
    const wrong = runArm((m) => {
      const realStep = m.step.bind(m);
      m.step = (addr, cyc) => realStep(addr, addr === 0x034b ? cyc - 1 : cyc);
      const realRet = m.ret.bind(m);
      m.ret = (cyc = 10) => realRet(cyc - 1); // perturb the ret charge too
      try { return optimized_0347(m); } finally { m.step = realStep; m.ret = realRet; }
    }, arm.a);
    assert.notEqual(wrong.cycles, o.cycles, `${arm.name}: cycle-total assertion has no teeth`);
  }
  console.log("  BRANCH: Z arm 0x7740 @25t, NZ arm 0x74E0 @39t — both EQUAL (RAM+regs+pc), totals pinned");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0347]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong marker-column return is CAUGHT as a register divergence", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0347, broken_0347, { maxFrames: FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong return — it is worthless");
  // sub_0347 writes NO work RAM -- its only output is HL/F -- so the unit teeth are
  // a REGISTER divergence (h: 0x77 -> 0x74), not a RAM address. RAM must stay clean.
  assert.equal(r.ram, null, "sub_0347 writes no RAM, so the RAM dump must be identical");
  assert.ok(r.regs != null, "a caught divergence must name the diverging register");
  assert.equal(r.regs.reg, "h", `expected the HL high byte to diverge, got ${r.regs.reg}`);
  console.log(
    `  TEETH/unit: caught at register ${r.regs.reg} ` +
      `(translated 0x${r.regs.a.toString(16)} vs broken 0x${r.regs.b.toString(16)})`,
  );
});
