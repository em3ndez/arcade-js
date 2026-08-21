// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for loc_2bd2 (ROM 0x2bd2) — "stack-adjust entry into the ready-sprite painter".
 *
 * loc_2bd2's only machine act is an `inc sp` that discards a byte of the pushed return before
 * falling into loc_2bd3; that is a stack/return effect the memory model drops, so the memory
 * behaviour is exactly the painter's. The gate compares RAM (dumpState, minus STACK_SCRATCH);
 * pc/SP/cycles are not compared, which is precisely why the stack adjust is invisible here.
 *
 * LIVE-OUT: none — memory only (the painter's four video cells, painted only when the anchor
 * does not already hold the painted marker 0xba).
 *
 * The leaf is not reached in a plain boot/attract, so both cases are CRAFTED: the anchor cell
 * is poked identically on both clones (unpainted vs already-painted).
 *
 * Jobs:
 *   1. EQUAL — unpainted anchor (paints) and already-painted anchor (no-op): loc_2bd2 == oracle
 *      in RAM (−stack).
 *   2. WRITE-SET — the paint touches only cells around the anchor; the already-painted case
 *      writes nothing.
 *   3. TEETH — a wrong painted cell is caught by the RAM diff.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-2bd2.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2bd2 as oracle } from "../../translated/loc_2bd2.js";
import { loc_2bd2 } from "../loc_2bd2.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, READY_SPRITE_TILE_VRAM } from "../names.js";

const PAINTED_MARKER = 0xba; // anchor value that means "already present" -> no repaint

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

function craft(anchor) {
  const m = BASE.clone();
  m.regs.sp = 0x8ffe; // the oracle's inc sp + nested calls stay within STACK_SCRATCH
  m.mem8[READY_SPRITE_TILE_VRAM] = anchor;
  return m;
}

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: unpainted (paints) and already-painted (no-op) — loc_2bd2 == oracle in RAM (−stack)", () => {
  for (const anchor of [0x00, PAINTED_MARKER]) {
    const o = craft(anchor);
    const c = craft(anchor);
    oracle(o);
    loc_2bd2(c);
    const d = ramDiffMinusStack(o, c);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} mod=${d.b} (anchor=${hx(anchor)})`);
  }
  console.log("  EQUAL: paint + already-painted cases identical (RAM −stack)");
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: painting changes some cells; the already-painted case writes nothing", () => {
  // paints
  {
    const before = craft(0x00);
    const after = craft(0x00);
    const b = before.dumpState();
    oracle(after);
    const a = after.dumpState();
    let changed = 0;
    for (let off = 0; off < b.length; off++) if (b[off] !== a[off]) changed++;
    assert.ok(changed > 0, "the paint path must write at least one cell");
    assert.equal(after.mem8[READY_SPRITE_TILE_VRAM], PAINTED_MARKER, "anchor cell stamped to 0xba");
  }
  // already painted -> no writes
  {
    const before = craft(PAINTED_MARKER);
    const after = craft(PAINTED_MARKER);
    const b = before.dumpState();
    oracle(after);
    const a = after.dumpState();
    let changed = 0;
    for (let off = 0; off < b.length; off++) if (b[off] !== a[off]) changed++;
    assert.equal(changed, 0, "already-painted must write nothing");
  }
  console.log("  WRITE-SET: paints when anchor != 0xba, no-op when == 0xba");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a wrong painted cell is CAUGHT by the RAM diff", () => {
  const o = craft(0x00);
  const c = craft(0x00);
  oracle(o);
  loc_2bd2(c);
  c.mem8[READY_SPRITE_TILE_VRAM] = 0x00; // BUG: anchor must be stamped, not left at 0

  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong painted cell");
  assert.equal(d.addr, READY_SPRITE_TILE_VRAM, `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH/RAM: wrong painted cell caught at ${hx(d.addr)}`);
});
