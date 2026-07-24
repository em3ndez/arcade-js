// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_1e57 -- the BOARD-COMPLETION / goal-reached gate at the head
 * of the 0x1E57 family (ld a,(BOARD); bit 2,a; jp nz,0x1e80; rra; ld a,(MARIO_Y);
 * jp c,0x1e7a; cp 0x51; ret nc; ld a,(MARIO_X); rla; fall into loc_1e6d). It dispatches
 * on the board-type byte + Mario's position to four exit arms; see optimized/sub_1e57.js
 * for the full behaviour + flag/cycle decisions.
 *
 * COLLAPSED: each arm's straight-line run folds into ONE m.step at that arm's exact
 * oracle total (arm1 31 t @0x1e80, arm2 58 t @0x1e7a, arm3 65 t + ret 11, arm4 87 t
 * @0x1e6d); the m.call / m.ret boundaries stay verbatim. `bit 2,a` and `rra` are dropped
 * (their flags are provably dead); `cp 0x51` and `rla` are kept (their flags reach exits).
 *
 * GATE = STRICT byte-exact whole-machine, MEASURED atomic. sub_1e57 is dispatched only
 * from loc_197a's NMI update cascade: probed over 1400 attract frames -> 816 dispatches
 * (first ~frame 586), io.nmiMask == 0 at 816/816 (mask-cleared inside the NMI, cannot
 * re-enter), and the NMI pushed PC lands in [0x1E57,0x1E8C) 0 times (0 anywhere in the
 * 0x1900-0x2FFF cascade band; all landings in the 0x02BD-0x0372 main-loop band). Atomic +
 * total-preserving + writes no VRAM/latch => byte-exact, so the STRICT gate is the correct
 * license (NOT convergent -- the sibling loc_1e7a's "interruptible" note is the stale
 * reading doc 06 corrects). Only arm2 occurs in attract (816/816); arms 1/3/4 are proven
 * from crafted identical-both-sides seeds with committed cycle totals.
 *
 * Jobs: STRICT whole-machine EQUAL (+ invocation proof) and its PRNG-fork cycle teeth;
 * UNIT EQUAL on the natural arm2 entry; FULL-BRANCH coverage of all four arms (EQUAL over
 * RAM + full register file + pc + SP AND each arm's exact oracle cycle total); per-arm
 * dropped-charge cycle teeth; a wrong-branch behavioural twin CAUGHT at GAME_SUBSTATE; and
 * a dropped-`rla` register twin CAUGHT on F.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_1e57 as translated_1e57 } from "../../translated/state0.js";
import { sub_1e57 as optimized_1e57 } from "../sub_1e57.js";
import { Machine } from "../../machine.js";
import { unitEquivalence, wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { GAME_SUBSTATE, BOARD, MARIO_X, MARIO_Y } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e57;
const FRAMES_WHOLE = 1400; // past the ~f586 first dispatch; 816 invocations (all arm2)
const FRAMES_UNIT = 640; // the unit host must run past the first dispatch (~f586) to capture it

const RET_ADDR = 0x19bc; // sub_1e57's own return address (into loc_197a, ROM 0x19BC)
const SENTINEL = 0x4dcc; // loc_197a's caller frame -- the UNWIND arms pop past it

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): sub_1e57 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1e57]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, all arm2)`);
});

test("STRICT-TEETH (cycles): a wrong arm2 charge forks the PRNG and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the exercised arm2
  // 57 t instead of 58 shifts the frame's cycle budget -> spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(BOARD);
    if (regs.a & 0x04) { m.step(0x1e80, 31); return m.call(0x1e80); }
    if (regs.a & 0x01) {
      regs.a = mem.read8(MARIO_Y);
      m.step(0x1e7a, 57); // DROPPED: correct is 58 t
      return m.call(0x1e7a);
    }
    regs.a = mem.read8(MARIO_Y);
    regs.cp(0x51);
    if (!regs.fC) { m.step(0x1e68, 65); m.ret(11); return true; }
    regs.a = mem.read8(MARIO_X);
    regs.rla();
    m.step(0x1e6d, 87);
    return m.call(0x1e6d);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural arm2 entry) ------------------------------------------------

test("EQUAL (unit): idiomatic sub_1e57 matches translated in RAM + full register file + pc", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1e57, optimized_1e57, { maxFrames: FRAMES_UNIT });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (natural arm2 entry)");
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides seeds: all four arms) ---

/**
 * Fresh machine modelling `call 0x1e57 from loc_197a @0x19B9`: a two-frame stack
 * (SENTINEL = loc_197a's caller frame, then RET_ADDR = sub_1e57's own return), and RAM
 * poked so the game's OWN dispatch drives sub_1e57 down the chosen arm (doc 06 pattern 3).
 * Returns { m, entrySP } with entrySP pointing at RET_ADDR.
 */
function seed(pokes) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(SENTINEL);
  m.push16(RET_ADDR);
  const entrySP = m.regs.sp;
  for (const [a, v] of pokes) m.mem.write8(a, v);
  return { m, entrySP };
}

/**
 * Prove one arm EQUAL (RAM + full register file + pc + SP + boolean return) AND pin its
 * exact cycle total: optimized must equal the oracle, and the oracle total must equal the
 * measured structural constant `expectCycles` (a regression guard whose teeth is the
 * per-arm dropped-charge test below).
 */
function assertArm(label, pokes, { cycles, ret, endPc, spDelta }) {
  const a = seed(pokes);
  const b = seed(pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  const retA = translated_1e57(a.m);
  const retB = optimized_1e57(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(retB, retA, `${label}: boolean return must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  // structural regression pins (oracle side):
  assert.equal(dA, cycles, `${label}: oracle total should be ${cycles} t (got ${dA})`);
  assert.equal(retA, ret, `${label}: oracle boolean should be ${ret}`);
  assert.equal(a.m.pc, endPc, `${label}: oracle should end at pc 0x${endPc.toString(16)}`);
  assert.equal(a.m.regs.sp, a.entrySP + spDelta, `${label}: oracle SP delta should be ${spDelta}`);
  console.log(`  BRANCH/${label}: EQUAL -- ${dB} t == oracle ${dA} t, ret=${retB}, ` +
    `pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}`);
}

test("BRANCH (unit): arm1 -- BOARD bit2 set -> loc_1e80 (RIVETS_LEFT!=0 -> ret nz, true)", () => {
  assertArm("arm1", [[BOARD, 0x04], [0x6290, 0x01]], { cycles: 59, ret: true, endPc: RET_ADDR, spDelta: 2 });
});

test("BRANCH (unit): arm1b -- BOARD bit2 set -> loc_1e80 (RIVETS_LEFT==0 -> board-complete unwind, false)", () => {
  assertArm("arm1b", [[BOARD, 0x04], [0x6290, 0x00]], { cycles: 93, ret: false, endPc: SENTINEL, spDelta: 4 });
});

test("BRANCH (unit): arm2 -- BOARD bit0 set -> loc_1e7a (Mario-Y guard, natural arm; ret nc, true)", () => {
  assertArm("arm2", [[BOARD, 0x01], [MARIO_Y, 0xf0]], { cycles: 76, ret: true, endPc: RET_ADDR, spDelta: 2 });
});

test("BRANCH (unit): arm3 -- Mario Y >= 0x51 -> normal ret (goal not reached, true)", () => {
  assertArm("arm3", [[BOARD, 0x00], [MARIO_Y, 0x60]], { cycles: 76, ret: true, endPc: RET_ADDR, spDelta: 2 });
});

test("BRANCH (unit): arm4 -- Mario Y < 0x51 -> loc_1e6d (0x694D by X bit7, 0x600A:=0x16, unwind, false)", () => {
  assertArm("arm4", [[BOARD, 0x00], [MARIO_Y, 0x20], [MARIO_X, 0x80]], { cycles: 167, ret: false, endPc: SENTINEL, spDelta: 4 });
});

// -- TEETH: cycles (per arm) --------------------------------------------------

/** Run the optimized routine on a seed with its FIRST m.step (the collapsed arm charge)
 *  shorted by 5 t; everything else (callee m.steps, m.ret) is untouched. Returns the
 *  total charged -- which must differ from the oracle if the per-arm total has teeth. */
function shortedArmTotal(pokes) {
  const { m } = seed(pokes);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (pc, t) => { realStep(pc, first ? t - 5 : t); first = false; };
  const c0 = m.cycles;
  optimized_1e57(m);
  return m.cycles - c0;
}

test("TEETH (cycles, every arm): a dropped collapse charge yields a wrong total and is CAUGHT", () => {
  const arms = [
    ["arm1", [[BOARD, 0x04], [0x6290, 0x01]], 59],
    ["arm1b", [[BOARD, 0x04], [0x6290, 0x00]], 93],
    ["arm2", [[BOARD, 0x01], [MARIO_Y, 0xf0]], 76],
    ["arm3", [[BOARD, 0x00], [MARIO_Y, 0x60]], 76],
    ["arm4", [[BOARD, 0x00], [MARIO_Y, 0x20], [MARIO_X, 0x80]], 167],
  ];
  for (const [label, pokes, oracleTotal] of arms) {
    const short = shortedArmTotal(pokes);
    assert.equal(short, oracleTotal - 5, `${label}: shorted twin should be 5 t under ${oracleTotal}`);
    assert.notEqual(short, oracleTotal, `${label}: cycle-total assertion has no teeth`);
  }
  console.log("  TEETH/cycles: every arm's collapsed charge caught by a 5 t short");
});

// -- TEETH: behavioural (wrong branch) + register (dropped rla flag) -----------

/** Wrong-branch twin: computes cp 0x51 but IGNORES its carry, always falling into the
 *  arm4 loc_1e6d tail. On the arm3 seed (Y >= 0x51) the correct routine returns true with
 *  no writes; this twin latches GAME_SUBSTATE (0x600A) -- a wrong-control-flow bug. */
function broken_wrongBranch(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  if (regs.a & 0x04) { m.step(0x1e80, 31); return m.call(0x1e80); }
  if (regs.a & 0x01) { regs.a = mem.read8(MARIO_Y); m.step(0x1e7a, 58); return m.call(0x1e7a); }
  regs.a = mem.read8(MARIO_Y);
  regs.cp(0x51);
  regs.a = mem.read8(MARIO_X);
  regs.rla();
  m.step(0x1e6d, 87); // BUG: no `ret nc` -- always into loc_1e6d
  return m.call(0x1e6d);
}

test("TEETH (behavioural): a wrong-branch twin (always into loc_1e6d) is CAUGHT at GAME_SUBSTATE", () => {
  const a = seed([[BOARD, 0x00], [MARIO_Y, 0x60], [MARIO_X, 0x80]]); // arm3 seed
  const b = seed([[BOARD, 0x00], [MARIO_Y, 0x60], [MARIO_X, 0x80]]);
  translated_1e57(a.m);
  broken_wrongBranch(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.ok(ram != null, "gate FAILED to catch a wrong branch -- it is worthless");
  assert.equal(ram.addr, GAME_SUBSTATE,
    `expected first diff at GAME_SUBSTATE 0x${GAME_SUBSTATE.toString(16)}, got 0x${ram.addr.toString(16)}`);
  console.log(`  TEETH/behavioural: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});

/** Register twin: drops the kept `rla` on arm4. With Mario X = 0x80 the carry loc_1e6d
 *  reads is 1 either way (cp 0x51 set it, X bit7 is also 1), so RAM is identical -- but the
 *  exit F differs (rla clears H/N and recomputes F3/F5 over cp's S/Z/PV). A pure register
 *  divergence the unit gate must catch on F. */
function broken_dropRla(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  if (regs.a & 0x04) { m.step(0x1e80, 31); return m.call(0x1e80); }
  if (regs.a & 0x01) { regs.a = mem.read8(MARIO_Y); m.step(0x1e7a, 58); return m.call(0x1e7a); }
  regs.a = mem.read8(MARIO_Y);
  regs.cp(0x51);
  if (!regs.fC) { m.step(0x1e68, 65); m.ret(11); return true; }
  regs.a = mem.read8(MARIO_X);
  // BUG: `rla` dropped -- carry stays cp's (still 1 for X=0x80), but F is not rla's.
  m.step(0x1e6d, 87);
  return m.call(0x1e6d);
}

test("TEETH (register): dropping the kept `rla` yields a wrong exit F and is CAUGHT", () => {
  const a = seed([[BOARD, 0x00], [MARIO_Y, 0x20], [MARIO_X, 0x80]]); // arm4 seed
  const b = seed([[BOARD, 0x00], [MARIO_Y, 0x20], [MARIO_X, 0x80]]);
  translated_1e57(a.m);
  broken_dropRla(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(ram, null, "RAM should be identical -- the twin's error is purely in F");
  assert.ok(regs != null && regs.reg === "f", `expected an F divergence, got ${regs ? regs.reg : "none"}`);
  console.log(`  TEETH/register: caught F diff -- oracle 0x${a.m.regs.f.toString(16)} vs broken 0x${b.m.regs.f.toString(16)}`);
});
