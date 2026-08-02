// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for decrementByteAt (ROM 0x2806) — decrement the byte at a pointer.
 *
 * dec_2806 is a LEAF `dec (hl); ret`: it decrements the byte the caller points at and
 * returns. Its entire memory-observable effect is that ONE byte, and that byte's new
 * value is a function of ONLY the old byte value — so the input space that moves the
 * output is exactly the 256 possible byte values. The pointer (HL) is the second input,
 * and it selects WHICH byte; the idiomatic routine promotes it to a parameter.
 *
 * The oracle's decrement flags and terminal `ret` are dead live-out: the sole caller
 * (ROM 0x27DA) tail-jumps in, and its caller (ROM 0x2722) resumes its own work — reloading
 * registers — without reading the returned flags. So the contract is memory-only. The
 * oracle pushes nothing (its `ret` only pops/reads the stack), so no stack byte is ever
 * written differently between the two sides and NO stack-scratch exclusion is needed —
 * the diff is the whole RAM dump (work + sprite + video).
 *
 * The spawn cascade this routine sits under is never reached in plain attract (0x2722 /
 * 0x27DA / 0x2806 dispatch 0 times across thousands of attract frames), so validation is
 * EXHAUSTIVE-over-input + CRAFTED pointers rather than captured dispatches:
 *
 *   1. EQUAL (exhaustive) — all 256 byte values at the real spawn-timer cell (0x62A7),
 *      HL pointed at it, oracle vs candidate, RAM identical. A proof over the value input.
 *   2. EQUAL (crafted) — the same decrement driven through pointers in work / sprite /
 *      video RAM, over edge byte values, proving the SUPPLIED address is honoured (not a
 *      hardcoded cell) and that the write lands correctly in every RAM region.
 *   3. TEETH — two broken twins the SAME sweeps must catch:
 *        (a) increment twin (byte + 1 instead of byte − 1) — caught by the exhaustive
 *            value sweep on the target byte.
 *        (b) fixed-address twin (always hits 0x6000, ignoring the pointer) — caught by
 *            both sweeps, because the real cell is left unchanged and a wrong cell moves.
 *   4. REACHABILITY — a real attract run, confirming 0x2806 is not naturally dispatched
 *      (documenting why we rely on exhaustive+crafted) and validating any dispatch that
 *      does occur, so the gate stays honest if the game ever reaches it.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2806.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2806 as oracle } from "../../translated/loc_2806.js";
import { decrementByteAt } from "../decrementByteAt.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2806;
// The oracle's `ret` pops the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: only pops), and this
// address is away from every cell the sweeps touch, so it never affects the compared RAM.
const SAFE_SP = 0x6bf8;
// The address the real caller (ROM 0x27DA) passes — a board-object spawn-cooldown cell.
const SPAWN_TIMER = 0x62a7;
// The wrong cell the fixed-address twin always hits — not touched by any sweep, so the
// twin genuinely diverges on every case.
const WRONG_CELL = 0x6000;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so RAM holds realistic
// values (the cells around the pointer, and the wrong-cell the fixed twin hits, are all
// non-trivial). The spawn body is never reached here; the entries are crafted by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A synthetic entry: a clone of `base` with the target byte set, HL pointed at it, a safe
 * stack, and the frame machinery neutralised so the oracle's `m.step` cannot fire an NMI
 * or push a frame while running in isolation.
 */
function makeEntry(base, addr, byte) {
  const e = base.clone();
  e.mem.write8(addr, byte);
  e.regs.hl = addr;
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * whole RAM dump (memory-equivalence contract; no stack-scratch exclusion — the oracle
 * writes no stack). A fresh entry per side because the routine WRITES memory.
 */
function runPair(base, addr, byte, candidate) {
  const a = makeEntry(base, addr, byte); // oracle reads HL
  const b = makeEntry(base, addr, byte); // candidate takes addr as a param
  oracle(a);
  candidate(b, addr);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

// Exhaustive over all 256 byte values at one address — the complete value-input space.
function exhaustiveSweep(base, addr, candidate) {
  let count = 0;
  for (let byte = 0; byte < 256; byte++) {
    const { ram } = runPair(base, addr, byte, candidate);
    count++;
    if (ram) return { mismatch: { addr, byte, ram }, count };
  }
  return { mismatch: null, count };
}

// Crafted pointers across the three RAM regions over edge byte values — proves the
// supplied address is honoured and the write lands in every region.
const CRAFTED = [
  { addr: SPAWN_TIMER, name: "spawn-timer cell (real use)" },
  { addr: 0x6100, name: "work RAM" },
  { addr: 0x7050, name: "sprite RAM" },
  { addr: 0x7500, name: "video RAM" },
];
const EDGE_BYTES = [0x00, 0x01, 0x34, 0x80, 0xff]; // wrap-to-255, to-zero, real reload, sign, high edge

function craftedSweep(base, candidate) {
  let count = 0;
  for (const { addr, name } of CRAFTED) {
    for (const byte of EDGE_BYTES) {
      const { ram } = runPair(base, addr, byte, candidate);
      count++;
      if (ram) return { mismatch: { addr, byte, name, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describe = (mm) =>
  mm &&
  `at addr=${hx(mm.addr)} byte=${hx(mm.byte)}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive over the value input) -------------------------------

test("EQUAL (exhaustive): decrementByteAt == oracle over all 256 byte values", () => {
  const base = attractBase();
  const { mismatch, count } = exhaustiveSweep(base, SPAWN_TIMER, decrementByteAt);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256, "must have compared the whole 256-value input space");
  console.log(`  EQUAL/exhaustive: ${count} byte values at ${hx(SPAWN_TIMER)} — RAM identical to the oracle`);
});

// -- 2. EQUAL (crafted pointers) ----------------------------------------------

test("EQUAL (crafted): the pointer is honoured across work / sprite / video RAM", () => {
  const base = attractBase();
  const { mismatch, count } = craftedSweep(base, decrementByteAt);
  assert.equal(mismatch, null, mismatch && `${mismatch.name}: ${describe(mismatch)}`);
  assert.equal(count, CRAFTED.length * EDGE_BYTES.length, "must have compared every crafted pointer/value");
  console.log(`  EQUAL/crafted: ${count} (pointer, byte) combos across ${CRAFTED.length} RAM regions — RAM == oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

/** BUG (a): increments instead of decrements. Every byte value diverges (v+1 != v-1). */
function brokenIncrement(m, addr) {
  const { mem } = m;
  mem.write8(addr, mem.read8(addr) + 1); // BUG: + instead of -
}

/** BUG (b): ignores the pointer and always decrements a fixed cell. The real cell is left
 *  unchanged (oracle decremented it) and a wrong cell moves — caught in both sweeps. */
function brokenFixedAddr(m) {
  const { mem } = m;
  mem.write8(WRONG_CELL, mem.read8(WRONG_CELL) - 1); // BUG: hardcoded address, pointer dropped
}

test("TEETH: the increment twin is CAUGHT by the exhaustive value sweep", () => {
  const base = attractBase();
  const { mismatch } = exhaustiveSweep(base, SPAWN_TIMER, brokenIncrement);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an increment-for-decrement twin — worthless");
  assert.equal(mismatch.ram.addr, SPAWN_TIMER, "the increment twin must diverge on the target byte");
  console.log(`  TEETH/increment: caught — ${describe(mismatch)}`);
});

test("TEETH: the fixed-address twin (ignores the pointer) is CAUGHT", () => {
  const base = attractBase();
  // Caught by the exhaustive sweep: at 0x62A7 the twin leaves the target byte untouched
  // and moves the wrong cell instead.
  const ex = exhaustiveSweep(base, SPAWN_TIMER, brokenFixedAddr);
  assert.notEqual(ex.mismatch, null, "the exhaustive sweep FAILED to catch a pointer-ignoring twin — worthless");
  // And caught by the crafted sweep across every region.
  const cr = craftedSweep(base, brokenFixedAddr);
  assert.notEqual(cr.mismatch, null, "the crafted sweep FAILED to catch a pointer-ignoring twin — worthless");
  console.log(`  TEETH/fixed-addr: caught — exhaustive ${describe(ex.mismatch)}; crafted ${describe(cr.mismatch)}`);
});

// -- 4. REACHABILITY (real attract) -------------------------------------------

test("REACHABILITY: 0x2806 in a real attract run — validate any natural dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const addr = b.regs.hl & 0xffff;
    oracle(a);
    decrementByteAt(b, addr);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch (hl=${hx(addr)}) diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  // 0 is expected — the spawn cascade is not exercised in attract; the exhaustive and
  // crafted sweeps carry the proof. Any dispatch that DOES occur is validated above.
  console.log(`  REACHABILITY: ${caps.length} natural 0x2806 dispatches in 2000 attract frames (proof carried by exhaustive+crafted)`);
});
