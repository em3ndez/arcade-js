// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_2079 (deactivate an object slot whose X ran off the left
 * edge, then tail-jump to the shared slot-loop tail 0x21ba). COLLAPSED to one m.step
 * (see ../sub_2079.js for the 52 t fold).
 *
 * REACHABILITY. Natural attract dispatch: the 25m attract demo throws barrels (the
 * 0x6700 object slots), and one rolls off the low edge at frame ~1300, where
 * branch_2053 (ROM 0x2061) does `add 0x08; cp 0x10; jp c 0x2079`. So a plain-boot
 * attract run dispatches sub_2079 for real -- no poke, no crafted entry. The whole
 * machine is driven identically on both sides through the shared factory.
 *
 * The whole-machine gate is the CONVERGENT gate, unconditionally: sub_2079 runs deep
 * inside loc_197a's INTERRUPTIBLE per-frame cascade (0x197a -> sub_1f72 -> branch_2053
 * -> here), so the vblank NMI can land inside its 52 t window; the collapse's only
 * observable effect is then a dead-stack PC push (excluded) or a self-healing raster
 * tear -- both benign, both false-failed by the strict byte-exact gate. Everything that
 * actually matters (a wrong cycle total forking the PRNG, a wrong store) is a PERSISTENT
 * divergence the convergent gate still catches.
 *
 * sub_2079 is STRAIGHT-LINE -- a single path, no data-dependent branch -- so the natural
 * dispatch covers the only arm; there is nothing to synthesize for full-branch coverage.
 * The collapsed total is pinned two ways: indirectly by the convergent cycle-broken twin
 * (a wrong total forks the PRNG -> persistent) and directly by the CYCLES test below.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2079 as translated_2079 } from "../../translated/state0.js";
import { sub_2079 as optimized_2079 } from "../sub_2079.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence as coreUnitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2079;
const SLOT_X = 0x03; // object X field offset from IX (see ../sub_2079.js)
// sub_2079 first dispatches at frame ~1300 of the 25m attract demo; a 1600-frame
// attract scenario fires it once with ~300 frames of tail to observe reconvergence.
const ATTRACT = { ...SCENARIOS.attract, frames: 1600 };
const UNIT_FRAMES = 1450; // must exceed the ~1300-frame first dispatch
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Capture the pristine machine at sub_2079's first NATURAL dispatch (no seed needed --
// the entry already carries the off-screen-object state that dispatched it). Reused by
// the unit EQUAL / CYCLES / unit TEETH tests so the ~1300-frame host run is paid once.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => { if (entry === null) entry = mm.clone(); return translated_2079(mm); }]]);
  const host = makeMachine(snap);
  host.runFrames(UNIT_FRAMES);
  if (entry === null) throw new Error("sub_2079 never dispatched — cannot capture an entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

function runBoth(optFn) {
  const a = ENTRY.clone(); // translated
  const b = ENTRY.clone(); // optimized (or broken twin)
  translated_2079(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
  };
}

// Cycles charged by sub_2079's OWN body, isolated from the shared 0x21ba tail: the tail is
// reached by `m.call(0x21ba)` and runs the whole slot-loop cascade (~4141 t) identically on
// both sides, so stubbing that one call to 0 t leaves exactly the routine-local total.
function localCycles(fn) {
  const mm = ENTRY.clone();
  const realCall = mm.call.bind(mm);
  mm.call = (addr, ...rest) => (addr === 0x21ba ? undefined : realCall(addr, ...rest));
  const c0 = mm.cycles;
  fn(mm);
  return mm.cycles - c0;
}

// Unit value-corruption twin: flip the value sub_2079 writes to SLOT_X (ix+3). The store
// is meant to zero it; the twin writes 0xff instead, so the RAM diff must name (ix+3).
function brokenSlotX(m) {
  const target = (m.regs.ix + SLOT_X) & 0xffff;
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (a, value, busOffset) => {
    if (!broke && a === target) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
    return realWrite(a, value, busOffset);
  };
  try { return optimized_2079(m); } finally { m.mem.write8 = realWrite; }
}

// Convergent cycle-broken twin: identical RAM + registers to the collapsed routine, but
// the single m.step charge is shaved 5 t. A wrong total shifts the main-loop spin count
// (0x6019 -> the PRNG seed 0x6018), a PERSISTENT non-stack divergence -- the teeth for the
// collapse's load-bearing invariant (total-cycle preservation).
function cyclebroken_2079(m) {
  const realStep = m.step.bind(m);
  let broke = false;
  m.step = (pc, cyc) => {
    if (!broke) { broke = true; return realStep(pc, cyc - 5); }
    return realStep(pc, cyc);
  };
  try { return optimized_2079(m); } finally { m.step = realStep; }
}

// -- EQUAL (whole-machine, convergent) -----------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_2079 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_2079]]), { scenario: ATTRACT });
  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`,
  );
});

// -- EQUAL (unit) --------------------------------------------------------------

test("EQUAL (unit): collapsed sub_2079 matches translated in RAM + registers + pc", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_2079, optimized_2079, { maxFrames: UNIT_FRAMES });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- CYCLES (single path) ------------------------------------------------------

test("CYCLES: collapsed sub_2079 charges the exact oracle total (52 t) on its one path", () => {
  const oracle = localCycles(translated_2079);
  const collapsed = localCycles(optimized_2079);
  assert.equal(collapsed, oracle, `cycle total mismatch (oracle ${oracle} t vs collapsed ${collapsed} t)`);
  assert.equal(oracle, 52, `expected the 4+19+19+10 = 52 t single-path total, got ${oracle}`);
  console.log(`  CYCLES: oracle ${oracle} t == collapsed ${collapsed} t (routine-local, 0x21ba tail excluded)`);
});

// -- TEETH ---------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_2079]]), { scenario: ATTRACT });
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

test("TEETH (unit): a wrong SLOT_X store is CAUGHT and names (ix+3)", () => {
  const { ram } = runBoth(brokenSlotX);
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  const expected = (ENTRY.regs.ix + SLOT_X) & 0xffff;
  assert.equal(ram.addr, expected, `expected first diff at (ix+3)=0x${expected.toString(16)}, got 0x${ram.addr.toString(16)}`);
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
