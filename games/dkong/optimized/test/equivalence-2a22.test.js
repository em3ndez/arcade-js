// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_2a22 -- the parameter wrapper that runs entry_2913's
 * collision search over the 6-record object table at 0x6600 (B=6, DE=0x10, IX=0x6600).
 * COLLAPSED: the three setup `ld` fold into one m.step (31 t) at 0x2A2B; the CALL and
 * the trailing `ret` stay verbatim boundaries.
 *
 * WHY CRAFTED ENTRIES (not a whole-machine / convergent run): sub_2a22 does not
 * dispatch in attract or in the standard gameplay window -- the 0x6600 objects have not
 * spawned yet (probed: 0 invocations over 1200 attract frames and 1600 driven-gameplay
 * frames). So a whole-machine run cannot exercise it, and cannot cover the collapsed
 * cycle total via the PRNG. Instead, exactly like sub_13ca, the routine is proven from
 * crafted entries that seed the REAL entry_2913 (resolved to the frozen oracle through
 * the routine registry, since no manifest is loaded here) on both its exits, and the
 * CYCLES test below pins each branch's total against the oracle DIRECTLY, with a
 * dropped-charge twin as the teeth.
 *
 * The seed models `call 0x2a22` from sub_29af @ 0x29BD: 0x29C0 on top of the stack
 * (sub_2a22's own return) with a SENTINEL below (the caller's-caller frame, which the
 * HIT path must NOT pop). The two branches:
 *   - HIT  (A=1): a record at 0x6600 is active and its box contains the subject ->
 *     entry_2913 discards 0x2A2E and returns to 0x29C0; sub_2a22 must NOT run its ret.
 *   - MISS (A=0): every slot inactive -> list exhausted -> entry_2913 returns normally
 *     to 0x2A2E; sub_2a22 runs its own ret to 0x29C0.
 * Both arms land the caller at 0x29C0 with SP consumed by exactly one frame; A differs.
 *
 * Jobs: EQUAL (both arms, RAM + full register file + pc + SP), CYCLES (each arm's exact
 * oracle total, the mandatory pin for a collapsed crafted-entry routine), and TEETH --
 * a behavioural twin that ignores the skip boolean (double-returns) AND a cycle twin
 * that drops a charge, both CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2a22 as translated_2a22 } from "../../translated/state0.js";
import { sub_2a22 as optimized_2a22 } from "../sub_2a22.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const SENTINEL = 0x4dcc; // caller's-caller frame -- the HIT path must NOT pop this
const RET_ADDR = 0x29c0; // sub_2a22's own return address (into sub_29af)

/**
 * Build a fresh machine seeded so `call 0x2a22 from 0x29BD` is modelled and
 * entry_2913 takes the requested exit. Mirrors boot.test.js's seed2a22 (already
 * validated to produce A=1 on hit / A=0 on miss). Returns { m, entrySP }.
 */
function seed({ hit }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(SENTINEL); // caller's-caller frame -- must survive
  m.push16(RET_ADDR); // sub_2a22's own return address
  const entrySP = m.regs.sp; // points at RET_ADDR
  m.regs.hl = 0x0505; // H,L = entry_2913 box half-spans (live-ins from sub_29af)
  m.regs.c = 0x10; // subject X
  m.regs.iy = 0x6b40;
  m.mem.write8(0x6b43, 0x20); // (iy+3) = subject Y
  if (hit) {
    m.mem.write8(0x6600, 0x01); // record 0 active (bit 0 set)
    m.mem.write8(0x6605, 0x10); // C - (ix+5) = 0 -> within X span
    m.mem.write8(0x6603, 0x20); // (iy+3) - (ix+3) = 0 -> within Y span
  }
  // MISS needs nothing: fresh RAM leaves every record's active bit clear.
  return { m, entrySP };
}

// -- EQUAL --------------------------------------------------------------------

/** Prove one arm EQUAL across RAM + the whole register file + pc + SP. */
function assertArmEqual(label, hit, expectA) {
  const a = seed({ hit });
  const b = seed({ hit });
  translated_2a22(a.m);
  optimized_2a22(b.m);

  assert.equal(a.m.regs.a, expectA, `oracle A should be ${expectA} on the ${label} arm`);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, "pc must match");
  assert.equal(a.m.regs.sp, b.m.regs.sp, "SP must match");
  assert.equal(b.m.pc, RET_ADDR, "both arms return to sub_2a22's caller (0x29C0)");
  assert.equal(b.m.regs.sp, b.entrySP + 2, "exactly one frame consumed");
  console.log(
    `  EQUAL/${label}: A=${b.m.regs.a}, pc=0x${b.m.pc.toString(16)}, ` +
      `sp=0x${b.m.regs.sp.toString(16)} -- RAM + regs + pc + SP identical`,
  );
}

test("EQUAL (crafted entry): MISS arm (A=0) -- sub_2a22 runs its own ret", () => {
  assertArmEqual("miss", false, 0x00);
});

test("EQUAL (crafted entry): HIT arm (A=1) -- entry_2913's skip, sub_2a22 does NOT ret", () => {
  assertArmEqual("hit", true, 0x01);
});

// -- CYCLES (mandatory: collapsed + crafted-entry, so no PRNG gate covers the total) --

test("CYCLES: collapsed sub_2a22 charges the exact oracle total on both arms", () => {
  for (const { name, hit } of [{ name: "miss (A=0, own ret)", hit: false }, { name: "hit (A=1, skip)", hit: true }]) {
    const a = seed({ hit });
    const b = seed({ hit });
    const ca0 = a.m.cycles, cb0 = b.m.cycles;
    translated_2a22(a.m);
    optimized_2a22(b.m);
    const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
    assert.equal(dB, dA, `${name}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
    console.log(`  CYCLES/${name}: oracle ${dA} t == collapsed ${dB} t`);
  }
});

// -- TEETH --------------------------------------------------------------------

/**
 * Behavioural twin: identical to the optimized routine EXCEPT it IGNORES entry_2913's
 * skip boolean and runs `ret` unconditionally. On the HIT arm entry_2913 has already
 * returned to 0x29C0, so this extra ret pops the SENTINEL frame -- a double-return the
 * gate must catch (wrong pc + wrong SP + the popped stack byte).
 */
function broken_doubleReturn(m) {
  const { regs } = m;
  regs.b = 0x06;
  regs.de = 0x0010;
  regs.ix = 0x6600;
  m.step(0x2a2b, 31);
  m.push16(0x2a2e);
  m.step(0x2913, 17);
  m.call(0x2913); // BUG: boolean ignored
  m.ret(); // BUG: runs even on the HIT (skip) path
}

test("TEETH (behavioural): a twin that ignores the skip boolean double-returns and is CAUGHT", () => {
  const a = seed({ hit: true });
  const b = seed({ hit: true });
  translated_2a22(a.m);
  broken_doubleReturn(b.m);

  const differs =
    a.m.pc !== b.m.pc ||
    a.m.regs.sp !== b.m.regs.sp ||
    firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off)) != null;
  assert.ok(differs, "gate FAILED to catch a double-return -- it is worthless");
  assert.equal(a.m.pc, RET_ADDR, "oracle stops at the caller (0x29C0)");
  assert.equal(b.m.pc, SENTINEL, "broken twin fell through to the caller's-caller SENTINEL");
  assert.equal(b.m.regs.sp, a.m.regs.sp + 2, "broken twin popped one frame too many");
  console.log(
    `  TEETH/behavioural: caught -- oracle pc 0x${a.m.pc.toString(16)} vs broken 0x${b.m.pc.toString(16)}`,
  );
});

test("TEETH (cycles): a dropped prologue charge yields a wrong total and is CAUGHT", () => {
  const a = seed({ hit: false });
  const b = seed({ hit: false });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2a22(a.m);
  // Same behaviour as optimized, but the collapsed prologue is 5 t short.
  (function cyclebroken(m) {
    const { regs } = m;
    regs.b = 0x06; regs.de = 0x0010; regs.ix = 0x6600;
    m.step(0x2a2b, 26); // DROPPED: the correct prologue total is 31 t
    m.push16(0x2a2e);
    m.step(0x2913, 17);
    if (!m.call(0x2913)) return;
    m.ret();
  })(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
