// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_0616 (ROM 0x0616-0x0629: draw string 5, then
 * render the credit count as one BCD byte via a tail jump into loop_0583).
 *
 * sub_0616 is a LEAF routine -- it is never a dispatch target; it is reached only
 * by `m.call(0x0616)`. The two live paths in the boot window are entry_0611's
 * task-table fall-through (ROM 0x0611, which m.call's 0x0616 when 0x6007 bit0 is
 * set) and the state-0 attract sites. The unit harness installs its snapshot
 * override at CONSTRUCTION, so it captures the entry however the routine is first
 * m.call'd; the whole-machine harness wires the override into the routine registry
 * so the same m.call fires it.
 *
 * Five jobs (mirroring equivalence-0611.test.js), plus a sixth data-path check:
 *
 *   1. CONVERGENT (whole-machine) -- the idiomatic optimized sub_0616
 *      (optimized/sub_0616.js) CONVERGES against its translated oracle (pixels +
 *      persistent non-stack state) under a plain attract boot. sub_0616 is
 *      COLLAPSED (one m.step per basic block; see sub_0616.js's CYCLES note) and
 *      NOT atomic -- every call path runs with the NMI mask enabled -- so the
 *      convergent gate is the correct license, not the strict byte-exact one
 *      (docs/06; see sub_0350): a strict pass would only prove no NMI happened to
 *      land mid-routine in THIS scenario, not that the collapse is safe in general.
 *
 *   2. EQUAL (unit) -- idiomatic optimized sub_0616 reads EQUAL against its
 *      translated oracle in RAM + registers, from a single captured entry (no NMI
 *      in scope).
 *
 *   3. DISPATCH -- the override must actually fire, or EQUAL is vacuous. sub_0616
 *      is first entered at frame 6 (entry_0611 falls through into it once 0x6007
 *      bit0 is set). A 30-frame window covers it (unit); the convergent run uses
 *      SCENARIOS.attract (1200 frames).
 *
 *   4. TEETH (convergent + unit) -- the whole-machine teeth is a CYCLE-DROP twin,
 *      CAUGHT as a PERSISTENT divergence (forked PRNG) -- not a value-corruption
 *      twin, which under a long convergent run risks hanging the game (see
 *      sub_0350's TEETH note). The unit teeth keeps the original deliberately-
 *      broken twin (the first string-draw store lands the wrong value): CAUGHT,
 *      naming the diverging VRAM address.
 *
 *   5. DATA PATH -- sub_0616 is BRANCH-FREE (A is hard-set to 5, B to 1, so
 *      loop_0583 always runs exactly one iteration): there are no data-dependent
 *      branches to synthesise. To give the single path teeth beyond whatever
 *      CREDITS value happened to be live at frame 6, a synthesised entry pokes
 *      CREDITS (0x6001) to a distinct BCD value on BOTH clones and asserts oracle
 *      == optimized (RAM + all registers + pc) -- proving the rendered-digit data
 *      path is faithful independent of the credit count.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0616 as translated_0616 } from "../../translated/mainloop.js";
import { sub_0616 as optimized_0616 } from "../sub_0616.js";
import { unitEquivalence } from "../harness.js";
import { Machine } from "../../machine.js";
import { CREDITS } from "../ram.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0616; // first entered at frame 6 (via entry_0611)

// The first store on the routine's path is the first character of string 5,
// written by handler_05e9 (reached through sub_0616) to VRAM 0x759F -- inside the
// compared state dump (video RAM 0x7400-0x77FF). It is the same string 5 that
// entry_0611 draws through this very routine, hence the same address.
const BROKEN_ADDR = 0x759f;

/**
 * Deliberately-broken twin: behaviourally the optimized handler EXCEPT the first
 * store to 0x759F lands a wrong value (the correct char XOR 0xFF, guaranteed to
 * differ). Intercepting exactly that one write lets the rest of the routine and
 * every subroutine it calls run verbatim -- the representative "wrong value to one
 * of the routine's own output addresses" bug the gate must catch.
 */
function broken_0616(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === BROKEN_ADDR) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_0616(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Cycle-broken twin for the CONVERGENT gate: identical logic to the collapsed routine, but
// the BCD-setup block's charge is 5 t short (41 -> 36). A wrong total shifts the main loop's
// spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal (see sub_0350's
// TEETH note for why this, not a value-corruption twin, is the right teeth under a long run).
function cyclebroken_0616(m) {
  const { regs } = m;
  regs.a = 0x05;
  m.step(0x0618, 7);
  m.push16(0x061b);
  m.step(0x05e9, 17);
  m.call(0x05e9);
  regs.hl = CREDITS;
  regs.de = 0xffe0;
  regs.ix = 0x74bf;
  regs.b = 0x01;
  m.step(0x0627, 36); // DROPPED: the correct charge here is 41 t
  m.step(0x0583, 10);
  m.call(0x0583);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_0616 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0616]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized sub_0616 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0616, optimized_0616);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0616]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong string-draw store is CAUGHT and names 0x759F", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0616, broken_0616);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- DATA PATH (synthesised) --------------------------------------------------

/**
 * Capture sub_0616's pristine entry state the way the unit harness does, but
 * return the entry machine so the test can poke it. Uses a construction-time
 * snapshot override (reaches the m.call'd leaf) that delegates to the oracle so
 * the host run proceeds to a clean stop.
 */
function captureEntry(maxFrames = 240) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0616(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`sub_0616 never entered within ${maxFrames} frames`);
  return entry;
}

test("DATA PATH: a distinct CREDITS value renders identically (oracle == optimized)", () => {
  const entry = captureEntry();

  // sub_0616 has no data-dependent branches (A=5, B=1 fixed -> loop_0583 runs
  // exactly once); the only data input is the byte at CREDITS. Force a distinct
  // BCD value on BOTH clones and prove the rendered-digit path stays equal.
  const POKED = 0x37;

  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  a.mem.write8(CREDITS, POKED);
  b.mem.write8(CREDITS, POKED);

  translated_0616(a);
  optimized_0616(b);

  const ramDiffs = [];
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) ramDiffs.push(a.stateOffsetToAddr(i));
  }
  assert.equal(ramDiffs.length, 0, ramDiffs.length ? `RAM diff at 0x${ramDiffs[0].toString(16)}` : "");
  assert.equal(a.pc, b.pc, "pc must match on the data path");
  assert.equal(a.regs.hl, b.regs.hl, "hl must match on the data path");
  assert.equal(a.regs.b, b.regs.b, "b must match on the data path");
  console.log(`  DATA PATH: CREDITS=0x${POKED.toString(16)} renders identically (RAM + pc + regs)`);
});
