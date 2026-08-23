// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for loc_2b23 (ROM 0x2b23, Pooyan) — the phase-timer tick. Each frame it
 * counts the phase timer down one step; when the reset latch is armed AND the timer has just
 * reached zero it re-enters the integrity-strip reset scan, otherwise it tails to the write-anim
 * dispatch redirect.
 *
 * SEATING: TAIL-CALL. Reached by tail-jump from the frame driver, so both delegatees run in that
 * caller's frame; loc_2b23 has no ret of its own. The reset-scan delegatee (0x2b59) is decompiled
 * in this same group and imported; the redirect (0x7e94) is not lifted this batch, so the module
 * keeps m.call(0x7e94) and the oracle drives the same frozen redirect — both walk identical
 * downstream code (its epilogue gate is held clear so that path stays a shallow no-op).
 *
 * LIVE-OUT: none — void tail step; equivalence is RAM (dumpState) minus STACK_SCRATCH.
 *
 * Cases are CRAFTED: a plain boot does not seat the latch/timer geometry.
 *
 * Jobs:
 *   1. EQUAL — reset-scan path (latch armed, timer->0), and two redirect paths (latch armed but
 *      timer stays nonzero; latch clear with timer->0): oracle == module in RAM (−stack).
 *   2. WRITE-SET — the reset-scan path blanks the attribute column; a redirect path leaves it
 *      untouched (the branch is observable, not vacuous).
 *   3. TEETH — a wrong seeded byte is caught by the RAM diff; an always-redirect twin (ignores the
 *      latch/timer gate) fails to blank the column on the reset-scan input and is caught.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-2b23.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2b23 as oracle } from "../../translated/loc_2b23.js";
import { loc_2b23 } from "../loc_2b23.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const PHASE_TIMER = 0x8808;
const LATCH = 0x8e2a; // RESET_SCAN_LATCH
const STRIP = 0x82bc; // integrity strip read by the reset scan (stride -0x20)
const ATTR_TOP = 0x855f; // attribute column the reset scan blanks (stride -0x20)
const ROW = 0x20;
const REDIRECT_GATE = 0x8802; // held clear so the frozen redirect epilogue is a shallow no-op
const INSERT_RANK = 0x89fc; // held clear so the latch-clear redirect stays shallow
const SP0 = 0x8ff0;
const SEED = 0xee; // pre-dirty the attribute column so the blank is observable

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;
const colCells = () => Array.from({ length: 8 }, (_, k) => (ATTR_TOP - k * ROW) & 0xffff);
const stripCells = () => Array.from({ length: 10 }, (_, k) => (STRIP - k * ROW) & 0xffff);

function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

/** Seat SP + a clean redirect gate; poke the phase timer and latch per case. */
function seat(m, { timer, latch }) {
  m.regs.sp = SP0;
  m.mem.write8(REDIRECT_GATE, 0x00); // frozen redirect epilogue rets at once
  m.mem.write8(INSERT_RANK, 0x00);
  m.mem.write8(PHASE_TIMER, timer);
  m.mem.write8(LATCH, latch);
  for (const c of stripCells()) m.mem.write8(c, 0x00); // checksum mismatch -> scan stays shallow
  for (const c of colCells()) m.mem.write8(c, SEED); // pre-dirty so a blank is visible
  return m;
}

const craftScan = () => seat(BASE.clone(), { timer: 0x01, latch: 0x01 }); // -> reset scan
const craftRedirectBusy = () => seat(BASE.clone(), { timer: 0x05, latch: 0x01 }); // timer stays nonzero
const craftRedirectUnlatched = () => seat(BASE.clone(), { timer: 0x01, latch: 0x00 }); // latch clear

const CASES = [
  { name: "latch armed + timer->0 -> reset scan", craft: craftScan, blanks: true },
  { name: "latch armed + timer nonzero -> redirect", craft: craftRedirectBusy, blanks: false },
  { name: "latch clear + timer->0 -> redirect", craft: craftRedirectUnlatched, blanks: false },
];

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_2b23 == oracle in RAM (−stack)", () => {
  for (const cfg of CASES) {
    const o = cfg.craft();
    const c = cfg.craft();
    oracle(o);
    loc_2b23(c);
    const d = ramDiffMinusStack(o, c);
    assert.equal(d, null, d && `${cfg.name}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} module=${d.b}`);
  }
  console.log(`  EQUAL: ${CASES.length} outcomes identical (RAM −stack)`);
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: the reset-scan path blanks the column; a redirect path leaves it seeded", () => {
  const scan = craftScan();
  loc_2b23(scan);
  assert.equal(scan.mem.read8(PHASE_TIMER), 0x00, "the phase timer ticks to zero");
  for (const c of colCells()) assert.equal(scan.mem.read8(c), 0x10, `column cell ${hx(c)} blanked`);

  const redir = craftRedirectBusy();
  loc_2b23(redir);
  assert.equal(redir.mem.read8(PHASE_TIMER), 0x04, "the phase timer ticks but does not reach zero");
  for (const c of colCells()) assert.equal(redir.mem.read8(c), SEED, `column cell ${hx(c)} untouched`);
  console.log("  WRITE-SET: scan blanks; redirect leaves seeded");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a wrong seeded byte is CAUGHT by the RAM diff", () => {
  const o = craftScan();
  const c = craftScan();
  oracle(o);
  loc_2b23(c);
  c.mem.write8(ATTR_TOP, (o.mem.read8(ATTR_TOP) ^ 0xff) & 0xff);
  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a corrupted column byte");
  assert.equal(d.addr, ATTR_TOP, `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH(RAM): caught at ${hx(d.addr)}`);
});

// A wrong loc_2b23 that ticks the timer but ALWAYS redirects, never re-entering the reset scan.
function alwaysRedirect(m) {
  m.mem.write8(PHASE_TIMER, (m.mem.read8(PHASE_TIMER) - 1) & 0xff);
  return m.call(0x7e94);
}

test("TEETH: an always-redirect twin (ignores the gate) diverges on the reset-scan input", () => {
  const o = craftScan();
  const twin = craftScan();
  oracle(o);
  alwaysRedirect(twin);
  const d = ramDiffMinusStack(o, twin);
  assert.notEqual(d, null, "the gate FAILED to catch a branch that skips the reset scan");
  assert.ok(colCells().includes(d.addr), `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH(branch): caught at ${hx(d.addr)}`);
});
