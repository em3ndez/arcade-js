// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_19da -- the 3-entry, stride-4 table search over 0x6A0C
 * that tail-jumps to entry_19ed (0x19ED) on an X-match and `ret`s on no match. See
 * optimized/sub_19da.js for the full behaviour block.
 *
 * COLLAPSED per the decompiler-pipeline doc: the prologue folds into one m.step (30 t @ 0x19E2); each loop
 * iteration folds into one m.step (a looping no-match iter = 46 t @ 0x19E2, the last
 * no-match iter = 41 t @ 0x19EC, a match iter = 17 t @ 0x19ED); the `m.call` tail-jump
 * and the `m.ret` stay verbatim boundaries. The register/flag ops (cp, inc l x4, djnz)
 * are the identical z80.js helpers in oracle order, so F is byte-identical.
 *
 * GATE = STRICT byte-exact whole-machine (the routine is ATOMIC), MEASURED not assumed
 * (the oracle's "-> NotImplemented frontier" note is STALE -- entry_19ed is translated
 * and reached). Probe over 1400 attract frames: 816 dispatches from loc_197a's NMI
 * update cascade; io.nmiMask == 0 at 816/816 (inside the mask-cleared NMI, cannot
 * re-enter); the NMI's pushed PC lands in [0x19DA,0x19EC] 0x over 1394 NMIs (none in
 * 0x1900-0x19FF; all in the 0x02BD-0x0372 main-loop band). Atomic + exact per-arm total
 * => byte-exact, so the strict gate is the right license, not the convergent gate.
 *
 * The natural attract run exercises ONLY the no-match arm (816/816); the three match
 * arms (tail-jump into entry_19ed at slot 1/2/3) are covered by synthesised
 * identical-both-sides entries with per-arm cycle-total pins.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (no-match) and a dropped-flag behavioural twin
 * CAUGHT; FULL-BRANCH coverage of all four arms (EQUAL over RAM+regs+pc+SP AND each
 * arm's exact oracle cycle TOTAL, pinned to a measured constant); a dropped-charge
 * cycle twin CAUGHT; and a push-as-call behavioural twin CAUGHT on a match arm.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_19da as translated_19da } from "../../translated/state0.js";
import { sub_19da as optimized_19da } from "../sub_19da.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x19da;
const FRAMES_WHOLE = 1400; // past the ~f586 first dispatch; ~816 no-match invocations
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f586)
const RET_ADDR = 0x19b0; // sub_19da's own return address (into loc_197a) -- both exits land here

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ----------------

test("STRICT (whole-machine): sub_19da is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_19da]]));
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

test("STRICT-TEETH (cycles): a dropped prologue charge forks the trajectory and is CAUGHT", () => {
  // Total-cycle preservation is the load-bearing invariant. Charging the prologue 29 t
  // instead of 30 shifts every frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6203);
    regs.b = 0x03;
    regs.hl = 0x6a0c;
    m.step(0x19e2, 29); // DROPPED: the correct prologue total is 30 t
    for (;;) {
      regs.cp(mem.read8(regs.hl));
      if (regs.fZ) { m.step(0x19ed, 17); return m.call(0x19ed); }
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.djnz();
      if (regs.b !== 0) { m.step(0x19e2, 46); continue; }
      m.step(0x19ec, 41); break;
    }
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the no-match arm) -----------------------------

/** Capture the pristine machine the instant sub_19da is first entered (via m.call in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however
 *  the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_19da(mm);
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
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_19da(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    dA: a.cycles - ca0, dB: b.cycles - cb0,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_19da matches translated in RAM + full register file + pc (no-match)", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_19da);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  assert.equal(r.dB, r.dA, `cycle total mismatch (oracle ${r.dA} t vs collapsed ${r.dB} t)`);
  console.log(`  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical; ${r.dB} t == oracle ${r.dA} t`);
});

test("TEETH (unit behavioural): dropping the inc-l flags on the no-match exit is CAUGHT", () => {
  // The no-match exit F comes from the LAST `inc l` (djnz/ret set no flags). A twin that
  // advances L with a plain `+= 4` produces the same L but never writes S/Z/H/PV, so its
  // exit F differs -- exactly the dropped-flag risk this routine has. The whole-register
  // unit gate must catch it.
  const broken_dropFlags = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6203);
    regs.b = 0x03;
    regs.hl = 0x6a0c;
    m.step(0x19e2, 30);
    for (;;) {
      regs.cp(mem.read8(regs.hl));
      if (regs.fZ) { m.step(0x19ed, 17); return m.call(0x19ed); }
      regs.l = (regs.l + 4) & 0xff; // BUG: advances L but drops the inc-l flags
      regs.djnz();
      if (regs.b !== 0) { m.step(0x19e2, 46); continue; }
      m.step(0x19ec, 41); break;
    }
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_dropFlags);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped inc-l flag -- it is worthless");
  assert.ok(r.regs && r.regs.reg === "f", `expected the F register to diverge, got ${r.regs && r.regs.reg}`);
  console.log(`  TEETH/unit: caught -- ${r.regs.reg} diverged (dropped inc-l flags)`);
});

// -- FULL-BRANCH COVERAGE (synthesised identical-both-sides entries: all 4 arms) --

/**
 * Fresh machine with a valid stack (sub_19da's own return frame at 0x19B0) and RAM
 * poked so the game's OWN loop drives sub_19da down the chosen arm -- the sanctioned
 * identical-both-sides poke (the decompiler-pipeline doc pattern 3), applied to both clones through one seed:
 *   - no-match          : X=0x53, table 0xAA/0xBB/0xCC        -> ret (no tail-jump)
 *   - match slot 1 (HIT): X=0x50, table[0]=0x50; entry_19ed confirms (Y match, bit3
 *                         clear) and WRITES 0x6340/0x6342/0x6343 -> RAM coverage
 *   - match slot 2      : X=0x51, table[1]=0x51; entry_19ed Y-mismatch -> short ret nz
 *   - match slot 3      : X=0x52, table[2]=0x52; entry_19ed Y-mismatch -> short ret nz
 */
function seed(pokes) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_19da's own caller-return frame
  const entrySP = m.regs.sp;
  for (const [a, v] of pokes) m.mem.write8(a, v);
  return { m, entrySP };
}

const ARMS = {
  "no-match": { pokes: [[0x6203, 0x53], [0x6a0c, 0xaa], [0x6a10, 0xbb], [0x6a14, 0xcc]], cyc: 173 },
  "match-slot1-hit": { pokes: [[0x6203, 0x50], [0x6a0c, 0x50], [0x6a0d, 0x00], [0x6a0f, 0x30], [0x6205, 0x30]], cyc: 173 },
  "match-slot2": { pokes: [[0x6203, 0x51], [0x6a0c, 0xaa], [0x6a10, 0x51], [0x6a13, 0xff], [0x6205, 0x30]], cyc: 136 },
  "match-slot3": { pokes: [[0x6203, 0x52], [0x6a0c, 0xaa], [0x6a10, 0xbb], [0x6a14, 0x52], [0x6a17, 0xff], [0x6205, 0x30]], cyc: 182 },
};

/** Prove one arm EQUAL (RAM + full register file + pc + SP), pin its exact cycle total
 *  (optimized == oracle == the measured structural constant), and confirm it unwinds to
 *  the caller (0x19B0) with the stack balanced. */
function assertArm(label, pokes, expectCycles) {
  const a = seed(pokes);
  const b = seed(pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_19da(a.m);
  optimized_19da(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  assert.equal(b.m.pc, RET_ADDR, `${label}: must unwind to the caller (0x19B0)`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

for (const [label, { pokes, cyc }] of Object.entries(ARMS)) {
  test(`BRANCH (unit): ${label}`, () => assertArm(label, pokes, cyc));
}

test("BRANCH-TEETH (cycles): a dropped iteration charge yields a wrong total and is CAUGHT", () => {
  // match-slot3 traverses two looping no-match iterations before the match. Charging one
  // of them 45 t instead of 46 makes the arm total no longer match the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6203); regs.b = 0x03; regs.hl = 0x6a0c;
    m.step(0x19e2, 30);
    for (;;) {
      regs.cp(mem.read8(regs.hl));
      if (regs.fZ) { m.step(0x19ed, 17); return m.call(0x19ed); }
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.djnz();
      if (regs.b !== 0) { m.step(0x19e2, 45); continue; } // DROPPED: 46 -> 45
      m.step(0x19ec, 41); break;
    }
    m.ret();
  };
  const a = seed(ARMS["match-slot3"].pokes);
  const b = seed(ARMS["match-slot3"].pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_19da(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (behavioural): treating the tail-JUMP as a CALL (extra push16) is CAUGHT", () => {
  // The match is a `jp`, not a `call` -- there is NO push. A twin that pushes a return
  // frame before m.call(0x19ED) makes entry_19ed's ret pop THAT bogus frame instead of
  // sub_19da's own return address: wrong pc, wrong SP, and the stray pushed word in RAM.
  const broken_pushAsCall = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6203); regs.b = 0x03; regs.hl = 0x6a0c;
    m.step(0x19e2, 30);
    for (;;) {
      regs.cp(mem.read8(regs.hl));
      if (regs.fZ) {
        m.step(0x19ed, 17);
        m.push16(0x19ec); // BUG: a jp does not push -- this fakes a call frame
        return m.call(0x19ed);
      }
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
      regs.djnz();
      if (regs.b !== 0) { m.step(0x19e2, 46); continue; }
      m.step(0x19ec, 41); break;
    }
    m.ret();
  };
  const a = seed(ARMS["match-slot1-hit"].pokes);
  const b = seed(ARMS["match-slot1-hit"].pokes);
  translated_19da(a.m);
  broken_pushAsCall(b.m);
  const caught =
    a.m.pc !== b.m.pc ||
    a.m.regs.sp !== b.m.regs.sp ||
    firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off)) != null;
  assert.ok(caught, "gate FAILED to catch a push-as-call tail-jump bug -- it is worthless");
  assert.equal(a.m.pc, RET_ADDR, "oracle tail-returns to sub_19da's caller (0x19B0)");
  assert.notEqual(b.m.regs.sp, a.m.regs.sp, "broken twin left the stack unbalanced");
  console.log(
    `  BRANCH-TEETH/behavioural: caught -- oracle pc 0x${a.m.pc.toString(16)}/sp 0x${a.m.regs.sp.toString(16)} ` +
      `vs broken pc 0x${b.m.pc.toString(16)}/sp 0x${b.m.regs.sp.toString(16)}`,
  );
});
