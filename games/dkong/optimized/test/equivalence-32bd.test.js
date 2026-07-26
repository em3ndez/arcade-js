// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_32bd -- the 3-way BOARD (0x6227) dispatch: board 1 ->
 * sub_342c, board 2 -> sub_3478, everything else -> sub_34b9 (no range check). Each
 * arm is `call HANDLER` then this routine's own `ret`.
 *
 * COLLAPSED: each arm's fixed decode (ld + the dead cp chain + the jp z's it passes)
 * folds into ONE m.step at that arm's call PC; the CALL boundary (push16 + m.step +
 * m.call) and the trailing m.ret stay verbatim. Per-arm own totals: board1 = 57 t,
 * board2 = 74 t, default = 74 t (see sub_32bd.js).
 *
 * WHY CRAFTED ENTRIES (not a whole-machine / convergent run): sub_32bd's dispatcher
 * is the untranslated frontier entry_3202 (via entry_31b1) -- it does NOT dispatch in
 * attract (probed: 0 invocations over 700 attract frames). So a whole-machine run
 * cannot exercise it and cannot cover the collapsed cycle total via the PRNG spin
 * count. Instead, exactly like sub_2a22 / arm_1a4b, the routine is proven from crafted
 * entries that seed the REAL handlers (resolved to the frozen oracle through the
 * routine registry, since no manifest is loaded here) on all three arms, and the
 * CYCLES test pins each arm's total against the oracle DIRECTLY, with a
 * dropped-charge twin as the teeth.
 *
 * The seed models `call 0x32bd` from entry_3202 @ 0x327A: this routine's own return
 * address 0x327D on top of the stack, a SENTINEL below it (the caller's-caller frame,
 * which no arm may pop). IX is a valid work-RAM base (0x6200) so the handlers'
 * (ix+d) reads/writes land in real, deterministic RAM. BOARD is poked per arm. Every
 * arm consumes exactly one frame (the handler's ret pops sub_32bd's push, sub_32bd's
 * ret pops 0x327D) and lands the caller at 0x327D.
 *
 * Jobs: EQUAL (all three arms, RAM + full register file + pc + SP), CYCLES (each
 * arm's exact oracle total -- mandatory for a collapsed crafted-entry routine), and
 * TEETH -- a behavioural twin that mis-dispatches (board 1 -> sub_34b9) AND a cycle
 * twin that drops a decode charge, both CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_32bd as translated_32bd } from "../../translated/state0.js";
import { sub_32bd as optimized_32bd } from "../sub_32bd.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const BOARD = 0x6227; // ram.js BOARD
const RET_ADDR = 0x327d; // sub_32bd's own return address (into entry_3202)
const SENTINEL = 0x4dcc; // caller's-caller frame -- no arm may pop this
const IX_BASE = 0x6200; // valid work-RAM base for the handlers' (ix+d) fields

/**
 * Build a fresh machine seeded so `call 0x32bd from 0x327A` is modelled and BOARD
 * takes the requested value. Fresh work RAM is zero, so the handlers run a
 * deterministic path; IX points at real RAM. Returns { m, entrySP }.
 */
function seed(board) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(SENTINEL); // caller's-caller frame -- must survive
  m.push16(RET_ADDR); // sub_32bd's own return address (into entry_3202 @ 0x327D)
  const entrySP = m.regs.sp; // points at RET_ADDR
  m.regs.ix = IX_BASE;
  m.mem.write8(BOARD, board);
  return { m, entrySP };
}

// -- EQUAL --------------------------------------------------------------------

/** Prove one arm EQUAL across RAM + the whole register file + pc + SP. */
function assertArmEqual(label, board) {
  const a = seed(board);
  const b = seed(board);
  translated_32bd(a.m);
  optimized_32bd(b.m);

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, "pc must match");
  assert.equal(a.m.regs.sp, b.m.regs.sp, "SP must match");
  assert.equal(b.m.pc, RET_ADDR, "arm must return to sub_32bd's caller (0x327D)");
  assert.equal(b.m.regs.sp, b.entrySP + 2, "exactly one frame consumed");
  console.log(
    `  EQUAL/${label} (BOARD=${board}): pc=0x${b.m.pc.toString(16)}, ` +
      `sp=0x${b.m.regs.sp.toString(16)} -- RAM + regs + pc + SP identical`,
  );
}

test("EQUAL (crafted entry): BOARD==1 -> sub_342c", () => {
  assertArmEqual("board1", 0x01);
});

test("EQUAL (crafted entry): BOARD==2 -> sub_3478", () => {
  assertArmEqual("board2", 0x02);
});

test("EQUAL (crafted entry): default arm, BOARD==0 -> sub_34b9", () => {
  assertArmEqual("default0", 0x00);
});

test("EQUAL (crafted entry): default arm, BOARD==3 -> sub_34b9 (its own early ret z)", () => {
  assertArmEqual("default3", 0x03);
});

// -- CYCLES (mandatory: collapsed + crafted-entry, so no PRNG gate covers the total) --

test("CYCLES: collapsed sub_32bd charges the exact oracle total on every arm", () => {
  const cases = [
    { name: "board1 (0x342c)", board: 0x01, expect: 57 },
    { name: "board2 (0x3478)", board: 0x02, expect: 74 },
    { name: "default0 (0x34b9)", board: 0x00, expect: 74 },
    { name: "default3 (0x34b9 ret z)", board: 0x03, expect: 74 },
  ];
  for (const { name, board, expect } of cases) {
    const a = seed(board);
    const b = seed(board);
    const ca0 = a.m.cycles, cb0 = b.m.cycles;
    translated_32bd(a.m);
    optimized_32bd(b.m);
    const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
    assert.equal(dB, dA, `${name}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
    // sub_32bd's OWN contribution (dispatch decode + call + ret) is the total minus
    // the handler's cost. The whole-routine total is what the PRNG would observe, so
    // pin optimized == oracle above; the OWN-total constant below documents the arm.
    console.log(`  CYCLES/${name}: oracle ${dA} t == collapsed ${dB} t (own dispatch = ${expect} t)`);
  }
});

// -- TEETH --------------------------------------------------------------------

/**
 * Behavioural twin: mis-dispatches BOARD==1 to sub_34b9 (the default handler) instead
 * of sub_342c. sub_34b9 writes a DIFFERENT set of (ix+d) fields than sub_342c, so the
 * work RAM (and the handler's exit registers) diverge -- the gate must catch it.
 */
function broken_misdispatch(m) {
  const { regs, mem } = m;
  const board = mem.read8(BOARD);
  regs.a = board;
  // BUG: route board 1 through the default handler.
  m.step(0x32ce, 30);
  m.push16(0x32d1);
  m.step(0x34b9, 17); // WRONG handler (should be 0x342c)
  m.call(0x34b9);
  m.ret();
}

test("TEETH (behavioural): a twin that mis-dispatches board 1 to sub_34b9 is CAUGHT", () => {
  const a = seed(0x01);
  const b = seed(0x01);
  translated_32bd(a.m); // oracle: board 1 -> sub_342c
  broken_misdispatch(b.m); // twin: board 1 -> sub_34b9

  const ramDiff = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  const regDiff = firstRegDiff(a.m.regs, b.m.regs);
  const differs = ramDiff != null || regDiff != null;
  assert.ok(differs, "gate FAILED to catch a mis-dispatch -- it is worthless");
  console.log(
    `  TEETH/behavioural: caught -- ${ramDiff ? `RAM diff at 0x${(ramDiff.addr ?? 0).toString(16)}` : ""}` +
      `${regDiff ? ` reg diff at ${regDiff.reg}` : ""}`,
  );
});

test("TEETH (cycles): a dropped decode charge yields a wrong total and is CAUGHT", () => {
  const a = seed(0x01);
  const b = seed(0x01);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_32bd(a.m);
  // Same behaviour as optimized, but the collapsed decode is 5 t short.
  (function cyclebroken(m) {
    const { regs, mem } = m;
    const board = mem.read8(BOARD);
    regs.a = board;
    m.step(0x32ce, 25); // DROPPED: the correct board-1 decode total is 30 t
    m.push16(0x32d1);
    m.step(0x342c, 17);
    m.call(0x342c);
    m.ret();
  })(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
