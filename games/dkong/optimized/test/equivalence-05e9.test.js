// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for handler_05e9 (task table entry 3: draw a
 * doubly-indirected string vertically into VRAM). A MAIN-LOOP routine,
 * dispatched by dispatchTask -- the same path handler_05c6 uses, so the override
 * consult in dispatchTask (mainloop.js) drives it, and it is inert when the
 * override map is empty.
 *
 * Three jobs:
 *
 *   1. CONVERGENT (whole-machine) -- the collapsed optimized handler_05e9
 *      (optimized/handler_05e9.js) CONVERGES against its translated oracle under a
 *      whole-machine run (pixels + persistent non-stack state). The routine has NO
 *      callees (it inlines sub_0020's `pop hl / ret` tail), so there is nothing to
 *      import from translated/ for that.
 *
 *   2. DISPATCH -- the override must actually fire, or CONVERGENT/EQUAL is vacuous.
 *      handler_05e9 is queued at power-on init (handler_01c3 enqueues a task
 *      with D=0x03 -> table index 3 -> ROM 0x05E9, payload 4) and again by the
 *      attract sequence, so it fires repeatedly within the attract scenario window.
 *
 *   3. TEETH (convergent + unit) -- convergent: a CYCLE-DROP twin (one charge short)
 *      forks the main-loop spin count (0x6019 PRNG entropy), a PERSISTENT divergence,
 *      CAUGHT. unit: a deliberately-broken twin (the first character store lands the
 *      wrong value) must be CAUGHT: NOT-EQUAL, naming the diverging VRAM address.
 *
 * CYCLE CHARGES ARE COLLAPSED, ONE m.step PER BASIC BLOCK. A prior review found that
 * collapsing to one TOTAL PER PATH diverges under the STRICT whole-machine gate, even
 * though the totals are correct (prologue 118, drawing iter 93/98, terminator 44; the
 * UNIT gate below, which has no interrupt, reads EQUAL with them collapsed). The
 * vblank NMI fires INSIDE the loop on a frame-6 dispatch and the oracle pushes PC
 * 0x060d onto the stack; a per-iteration charge pushes 0x0600 instead, so the STRICT
 * whole-machine trace diverges at frame 7, addr 0x6bf2 -- squarely inside the dead
 * stack scratch [0x6be0,0x6c00). That is exactly the INTERRUPTIBLE-collapse signature
 * the CONVERGENT gate exists for (docs/decompiler-pipeline): the divergence heals, no persistent
 * non-stack state or pixel divergence survives, so the whole-machine job now runs
 * under convergentGate instead (unlike handler_05c6, short enough to stay byte-exact).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { handler_05e9 as translated_05e9 } from "../../translated/mainloop.js";
import { handler_05e9 as optimized_05e9 } from "../handler_05e9.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x05e9;

// The first character store of the FIRST dispatch (payload 4) lands at VRAM
// 0x7680; the string is drawn upward, -32 (one tilemap row) per char. This is
// the write the unit harness captures, and it is inside the compared state dump
// (video RAM 0x7400-0x77FF).
const BROKEN_ADDR = 0x7680;

/**
 * Deliberately-broken twin: behaviourally the optimized handler EXCEPT the first
 * store to 0x7680 lands a wrong value (the correct tile XOR 0xFF, guaranteed to
 * differ). Intercepting exactly that one write lets the rest of the routine run
 * verbatim -- the representative "wrong value to one of the routine's own output
 * cells" bug the gate must catch.
 */
function broken_05e9(m) {
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
    return optimized_05e9(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Local copies of handler_05e9.js's private ROM-literal constants (not exported --
// this test builds a from-scratch cycle-broken twin, so it needs its own copies).
const STRING_PTR_TABLE = 0x364b;
const VRAM_ROW_STEP = 0xffe0;
const STRING_TERMINATOR = 0x3f;
const BLANK_TILE = 0x10;
const TABLE_INDEX_MASK = 0x7f;

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the drawing-iteration total is 5 t short, so a wrong total
 * forks the main loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence,
 * never a heal. This is the teeth for the collapse's load-bearing invariant
 * (total-cycle preservation).
 */
function cyclebroken_05e9(m) {
  const { regs, mem } = m;
  regs.hl = STRING_PTR_TABLE;
  regs.add(regs.a);
  m.push16(regs.af);
  regs.and(TABLE_INDEX_MASK);
  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de);
  regs.e = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  regs.exDeHl();
  regs.e = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.bc = VRAM_ROW_STEP;
  regs.exDeHl();
  m.step(0x0600, 118);

  for (;;) {
    regs.a = mem.read8(regs.de);
    regs.cp(STRING_TERMINATOR);
    m.step(0x0603, 14);
    if (regs.fZ) {
      regs.hl = m.pop16();
      m.ret(30);
      return;
    }
    mem.write8(regs.hl, regs.a);
    regs.af = m.pop16();
    m.step(0x0608, 27);
    if (regs.fNC) {
      m.step(0x060c, 7); // DROPPED: correct is 12 t
    } else {
      mem.write8(regs.hl, BLANK_TILE);
      m.step(0x060c, 17);
    }
    m.push16(regs.af);
    regs.de = (regs.de + 1) & 0xffff;
    regs.addHl(regs.bc);
    m.step(0x0600, 40);
  }
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed handler_05e9 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_05e9]]), { scenario: SCENARIOS.attract });

  // The override must actually have run, or CONVERGENT would be vacuous.
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

test("EQUAL (unit): idiomatic optimized handler_05e9 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_05e9, optimized_05e9);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_05e9]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong character store is CAUGHT and names 0x7680", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_05e9, broken_05e9);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store -- it is worthless");
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
