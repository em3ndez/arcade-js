// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_2f97 -- the `(0x6217) bit0 clear` tail of entry_2ed4 (the
 * two-object sprite-state updater in loc_197a's per-frame NMI cascade). It reads
 * MARIO_HAMMER_PENDING (0x6218): bit0 clear -> `ret` (EXIT-2); bit0 set -> build the
 * alternate sprite-attribute pair B/C, mirror SND_BGM (0x6089) -> SCRATCH_6389, and
 * `jp 0x2f7c` into the shared record write loc_2f7c. See optimized/loc_2f97.js for the
 * full behaviour block.
 *
 * COLLAPSED: Block 1 (ld a,(0x6218) 13 + rrca 4 = 17 t, exit 0x2F9B) folds the two ops;
 * the RET arm is 28 t (17 + `ret nc` taken 11); the BUILD arm folds `ret nc` not-taken
 * (5) + the whole 0x2F9C..0x2FB4 body incl `jp` (113) into one 118 t m.step at 0x2F7C,
 * then m.call(0x2f7c). Only the `ret` and the `jp`->m.call boundary are kept; no
 * hardware-latch write is crossed (every write is work RAM).
 *
 * GATE = STRICT (byte-exact whole-machine). loc_2f97 is ATOMIC: measured over 1200
 * attract frames, 616 dispatches with io.nmiMask==0 at 616/616 (it runs only inside the
 * NMI cascade, mask cleared by entry_0066), and the NMI's pushed PC never lands in
 * [0x2F97,0x2FB5) (0/28 distinct NMI PCs in range). entry_2ed4 has a single caller
 * (loc_197a @0x1998) and no dispatch entry, so there is no mask-enabled path. A collapse
 * that preserves each arm's exact cycle total therefore passes the strict byte-exact gate
 * and needs no convergent gate.
 *
 * BRANCH COVERAGE. Attract exercises ONLY the RET arm (0x6218 bit0=0, 616/616) -- covered
 * live by the whole-machine gate and localized by the unit gate. The BUILD arm (bit0=1) is
 * unreached in attract/gameplay, so it is SYNTHESISED here with identical-both-sides seeds
 * (0x6218=1, IX=0x6680, DE=0x6A18) covering BOTH facings of the sprite-code bit7 the build
 * threads into B, and pinned EQUAL over RAM + full register file + pc + SP AND its exact
 * oracle cycle total (297 t incl loc_2f7c) AND the built attribute byte B (0x1E / 0x9E) as it
 * lands in the record at 0x6A19.
 *
 * THE FACING-BIT TEETH (why bit7=0 is mandatory). On BUILD, 0x6218 bit0 is structurally 1,
 * so Block 1's `rrca` leaves CARRY=1; `rlca` then overwrites it with sprite-code bit7 and
 * `rra` rotates it into B's bit7. With bit7=1 the rlca-carry coincides with the incoming
 * carry, so a dropped `rlca` is INVISIBLE (B=0x9E either way) -- a real gap the reviewer
 * caught. With bit7=0 the `rlca` genuinely clears the carry (B=0x1E), so a drop-`rlca` twin
 * builds B=0x9E and is caught at the record byte 0x6A19. Both are asserted below.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry (RET arm) and behavioural teeth; FULL-BRANCH coverage of
 * the RET arm and BOTH BUILD facings from crafted identical-both-sides seeds (EQUAL + exact
 * cycle TOTAL + built B byte); a dropped-charge cycle twin CAUGHT; and a dropped-`rlca`
 * facing-bit twin CAUGHT at 0x6A19.
 *
 * Run: node --test games/dkong/optimized/test/equivalence-2f97.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f97 as translated_2f97 } from "../../translated/state0.js";
import { loc_2f97 as optimized_2f97 } from "../loc_2f97.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2f97;
const FRAMES_WHOLE = 1200; // ~616 RET-arm invocations (first dispatch ~f586)
const FRAMES_UNIT = 650; // must run past the ~f586 first dispatch to capture it

const RET_ADDR = 0x199b; // entry_2ed4's caller-return frame (loc_197a @0x199B)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, no collapse loss) ----

test("STRICT (whole-machine): loc_2f97 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_2f97]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic)`);
});

test("STRICT-TEETH (cycles): a wrong Block-1 charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging Block 1 16 t instead
  // of 17 shifts every dispatch's cycle budget -> the spin count 0x6019 (PRNG entropy) and
  // where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6218);
    regs.rrca();
    m.step(0x2f9b, 16); // DROPPED: Block 1 total is 17 t, not 16
    if (regs.fNC) { m.ret(11); return; }
    const R = (d) => (regs.ix + d) & 0xffff;
    mem.write8(R(0x09), 0x06);
    mem.write8(R(0x0a), 0x03);
    regs.a = mem.read8(0x6207); regs.rlca(); regs.a = 0x3c; regs.rra();
    regs.b = regs.a; regs.c = 0x07;
    regs.a = mem.read8(0x6089); mem.write8(0x6389, regs.a);
    m.step(0x2f7c, 118);
    return m.call(0x2f7c);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry: the RET arm) ------------------------------------------

/** Capture the pristine machine the instant loc_2f97 is first entered (via m.call, deep in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however the
 *  routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2f97(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_2f97(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_2f97 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_2f97);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  // The natural first entry is the RET arm (0x6218 bit0=0): early return, no work-RAM write.
  assert.equal(NATURAL_ENTRY.mem.read8(0x6218) & 1, 0, "natural first entry should be the RET arm");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural RET arm)");
});

test("TEETH (unit behavioural): ignoring the ret-nc branch (always building) is CAUGHT", () => {
  // On the RET-arm natural entry the oracle returns early. A twin that ignores the branch
  // and always runs the build path writes (ix+9)/(ix+a)/SCRATCH_6389 and jumps to loc_2f7c
  // -- so its RAM/pc/SP diverge from the oracle's early return.
  const broken_alwaysBuild = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(0x6218);
    regs.rrca();
    m.step(0x2f9b, 17); // BUG: no `ret nc` -- always falls through to the build path
    mem.write8(R(0x09), 0x06);
    mem.write8(R(0x0a), 0x03);
    regs.a = mem.read8(0x6207); regs.rlca(); regs.a = 0x3c; regs.rra();
    regs.b = regs.a; regs.c = 0x07;
    regs.a = mem.read8(0x6089); mem.write8(0x6389, regs.a);
    m.step(0x2f7c, 118);
    return m.call(0x2f7c);
  };
  const r = runBoth(NATURAL_ENTRY, broken_alwaysBuild);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an ignored branch -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides seeds: both arms) --------------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and RAM/registers set
 * so loc_2f97's OWN branch drives the chosen arm -- the sanctioned identical-both-sides
 * seed (the decompiler-pipeline doc pattern 3), applied to oracle and optimized through the same factory:
 *   - 0x6218 bit0=0            -> RET arm (early `ret nc`), self-contained, 28 t.
 *   - 0x6218 bit0=1 + IX/DE set -> BUILD arm: build B/C, mirror BGM, jp into loc_2f7c, 297 t.
 * IX/DE mirror entry_2ed4's live-ins (0x6680 base, 0x6A18 record dest); (ix+0e/0f) and
 * MARIO_X/Y are seeded so loc_2f7c writes to work RAM cleanly.
 *
 * THE FACING BIT is the subtle one, and `spriteCode` (MARIO_SPRITE_CODE 0x6207) controls it.
 * On the BUILD arm 0x6218 bit0 is structurally 1, so Block 1's opening `rrca` leaves CARRY=1
 * ALWAYS. `rlca` then OVERWRITES that carry with sprite-code bit7, and `rra` rotates it into
 * B's bit7 (B = 0x1E | facing<<7). So the `rlca` only CHANGES the output when sprite-code
 * bit7 = 0 (carry 1 -> 0); with bit7 = 1 the rlca-carry coincides with the incoming carry and
 * a dropped `rlca` is invisible. The teeth therefore REQUIRE a bit7=0 case -- both facings are
 * covered below, and the drop-`rlca` twin is seeded bit7=0.
 */
function seed({ bit0, spriteCode = 0x25 }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_2ed4's caller-return frame
  const entrySP = m.regs.sp;
  m.regs.ix = 0x6680; // object record base, as entry_2ed4 sets it
  m.regs.de = 0x6a18; // record dest for loc_2f7c
  m.mem.write8(0x6218, bit0 ? 0x01 : 0x00);
  m.mem.write8((0x6680 + 0x0e) & 0xffff, 0x00); // (ix+0e) as entry_2ed4 set
  m.mem.write8((0x6680 + 0x0f) & 0xffff, 0xf0); // (ix+0f)
  m.mem.write8(0x6207, spriteCode); // MARIO_SPRITE_CODE: bit7 = the facing carried into B
  m.mem.write8(0x6089, 0x42); // SND_BGM
  m.mem.write8(0x6203, 0x30); // MARIO_X (loc_2f7c)
  m.mem.write8(0x6205, 0x50); // MARIO_Y (loc_2f7c)
  return { m, entrySP };
}

// The BUILD arm writes B into the object record at 0x6A19 (loc_2f7c: HL=DE=0x6A18,
// record[0]=X at 0x6A18, inc hl, record[1]=B at 0x6A19). That byte is where a wrong
// facing bit surfaces -- see the drop-`rlca` teeth below.
const REC_B_ADDR = 0x6a19;

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total:
 *  optimized must equal the oracle, and the oracle total must equal `expectCycles`. When
 *  `expectB` is given (BUILD arm) it also pins B and the record byte 0x6A19, so the facing
 *  bit is an ASSERTED output, not incidental. */
function assertArm(label, opts, expectCycles, expectB) {
  const a = seed(opts);
  const b = seed(opts);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2f97(a.m);
  optimized_2f97(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // Both arms unwind to the caller sentinel with the stack balanced (RET arm: own ret;
  // BUILD arm: loc_2f7c's ret).
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return/unwind to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  let extra = "";
  if (expectB !== undefined) {
    // Pin the built attribute byte both in register B and where loc_2f7c stored it.
    assert.equal(a.m.regs.b, expectB, `${label}: oracle B should be 0x${expectB.toString(16)}`);
    assert.equal(a.m.mem.read8(REC_B_ADDR), expectB, `${label}: oracle record[0x6A19] should be 0x${expectB.toString(16)}`);
    extra = `, B=0x${b.m.regs.b.toString(16)} rec[0x6A19]=0x${b.m.mem.read8(REC_B_ADDR).toString(16)}`;
  }
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t${extra}`);
}

test("BRANCH (unit): RET arm -- 0x6218 bit0=0, early `ret nc` (28 t, no callee)", () => {
  assertArm("ret-nc", { bit0: 0 }, 28);
});

// BOTH facings, so the rlca/rra facing-bit path is exercised where it CHANGES the output.
test("BRANCH (unit): BUILD arm, facing bit7=0 -- rlca clears carry -> B=0x1E (297 t)", () => {
  assertArm("build-face0", { bit0: 1, spriteCode: 0x25 }, 297, 0x1e);
});

test("BRANCH (unit): BUILD arm, facing bit7=1 -- rlca sets carry -> B=0x9E (297 t)", () => {
  assertArm("build-face1", { bit0: 1, spriteCode: 0xa5 }, 297, 0x9e);
});

test("BRANCH-TEETH (cycles): a dropped build-block charge yields a wrong total and is CAUGHT", () => {
  // BUILD-arm body charged 117 t instead of 118 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(0x6218);
    regs.rrca();
    m.step(0x2f9b, 17);
    if (regs.fNC) { m.ret(11); return; }
    mem.write8(R(0x09), 0x06);
    mem.write8(R(0x0a), 0x03);
    regs.a = mem.read8(0x6207); regs.rlca(); regs.a = 0x3c; regs.rra();
    regs.b = regs.a; regs.c = 0x07;
    regs.a = mem.read8(0x6089); mem.write8(0x6389, regs.a);
    m.step(0x2f7c, 117); // DROPPED: build block is 118 t, not 117
    return m.call(0x2f7c);
  };
  const a = seed({ bit0: 1 });
  const b = seed({ bit0: 1 });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2f97(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (facing bit): a twin that DROPS `rlca` builds the wrong B and is CAUGHT", () => {
  // The BUILD arm is unreached by the whole-machine gate, so this crafted case is the ONLY
  // proof of the facing-bit logic -- and it only has teeth when sprite-code bit7 = 0. There
  // Block 1's `rrca` leaves CARRY=1, `rlca` clears it to 0 (bit7), and `rra` -> B=0x1E. A
  // twin that omits the `rlca` keeps the stale CARRY=1, so B=0x9E: loc_2f7c writes it to the
  // record at 0x6A19 and the diff is caught. (With bit7=1 the two carries coincide and this
  // twin would PASS -- exactly the masked gap the bit7=0 seed closes.)
  const broken_dropRlca = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(0x6218);
    regs.rrca();
    m.step(0x2f9b, 17);
    if (regs.fNC) { m.ret(11); return; }
    mem.write8(R(0x09), 0x06);
    mem.write8(R(0x0a), 0x03);
    regs.a = mem.read8(0x6207); /* BUG: `rlca` dropped -- stale carry threads into rra */
    regs.a = 0x3c; regs.rra();
    regs.b = regs.a; regs.c = 0x07;
    regs.a = mem.read8(0x6089); mem.write8(0x6389, regs.a);
    m.step(0x2f7c, 118);
    return m.call(0x2f7c);
  };
  const r = runBoth2(broken_dropRlca);
  const caught = r.ram != null || r.regs != null;
  assert.ok(caught, "facing-bit gate FAILED to catch a dropped rlca -- the crafted seed has no teeth");
  assert.equal(r.a.regs.b, 0x1e, "oracle B (bit7=0) should be 0x1E");
  assert.equal(r.b.regs.b, 0x9e, "drop-rlca twin builds B=0x9E");
  assert.equal((r.ram && r.ram.addr) ?? REC_B_ADDR, REC_B_ADDR, "diff surfaces at the record B byte 0x6A19");
  console.log(`  BRANCH-TEETH/facing: caught at 0x${((r.ram && r.ram.addr) ?? REC_B_ADDR).toString(16)} -- ` +
    `oracle B=0x${r.a.regs.b.toString(16)} vs drop-rlca B=0x${r.b.regs.b.toString(16)}`);
});

/** Run oracle vs `fn` on independent BUILD-arm clones seeded bit7=0 (0x25); report the diff. */
function runBoth2(fn) {
  const a = seed({ bit0: 1, spriteCode: 0x25 });
  const b = seed({ bit0: 1, spriteCode: 0x25 });
  translated_2f97(a.m);
  fn(b.m);
  return {
    ram: firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.m.regs, b.m.regs),
    a: a.m, b: b.m,
  };
}
