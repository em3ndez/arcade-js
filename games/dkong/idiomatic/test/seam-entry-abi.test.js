// SPDX-License-Identifier: GPL-3.0-only
/**
 * seam-entry-abi — the gate for the PURE-SIGNATURE WIRING CLASS.
 *
 * THE DEFECT THIS EXISTS FOR. A ROUTINES entry can be wired LIVE as an override
 * (resolveAllIdiomatic, swap_check --all, web/worker.js), and the seam dispatches an
 * override as `fn(m)` — ONE argument, the Machine. Five idiomatic routines are deliberately
 * PURE functions of their Z80 register inputs, because their idiomatic callers pass proper
 * arguments and their gates are exhaustive over that pure shape:
 *
 *     0x0347  selectPlayerIndicatorColumnBase(playerSelector)
 *     0x1783  allSlotsClear(mem, base, stride)
 *     0x2333  snapYToGirder(x, y, step)
 *     0x2FF0  tileAddrForPixel(y, x)
 *     0x3009  nextAnimationStep(a, b)
 *
 * Registering one of those at a ROM address hands it the MACHINE as its first coordinate
 * and the rest `undefined`. `snapYToGirder` then computed `x % 16` = NaN, failed both
 * boundary tests and returned `undefined` having written nothing — a silent no-op that
 * HAPPENS to match the oracle's frequent early-out, which is why it survived every
 * per-routine gate. It was the full flip's wall at frame 710. 0x3009 was worse: its
 * faithful non-termination on garbage arguments hung the process outright.
 *
 * THE FIX EACH ADDRESS NOW CARRIES is a second export in the same module — the ROM-level
 * ABI wrapper, named by `ROUTINES[addr].entry` — that marshals the Z80 registers into the
 * pure function and writes the results back. The pure function is untouched.
 *
 * ★ WHY EVERY TEST HERE DISPATCHES THROUGH `m.call(ADDR)`. Calling an adapter directly
 * reproduces the original blind spot exactly: the defect was never in the arithmetic, it
 * was in what the SEAM hands the function. So each case builds a translated caller's
 * bracket (`push16(RET)` then `m.call(ADDR)`) on a machine with the entry wired as an
 * override, runs the frozen oracle on an identically-seeded machine, and diffs.
 *
 * WHAT IS COMPARED. Register-EXACT — every register, the flag byte, SP, pc and RAM — where
 * the wrapper can reproduce the oracle's whole exit state cheaply (0x0347, 0x2FF0, 0x3009).
 * The documented LIVE-OUT ONLY where reproducing the residuals would mean restating the
 * routine inside its own wrapper (0x2333, 0x1783); each of those two modules' seam-entry
 * headers carries the call-site evidence that the dropped residuals are dead, and the
 * whole-machine gates (tools/swap_check.mjs --all, idiomatic.test.js) stand behind it.
 *
 * COVERAGE NOTE worth stating rather than implying: under the FULL flip only 0x2333's entry
 * is dispatched at all (measured: 957 dispatches over 1500 attract frames), because the
 * other four addresses' callers are themselves idiomatic and call the pure function
 * directly as a JS import. `swap_check --routines 347,1783,2333,2ff0,3009` — every caller
 * left translated — dispatches four of the five and is transparent for 12000 frames; 0x1783
 * is reached by neither, so THIS file is its only live coverage.
 *
 * Run: node --test games/dkong/idiomatic/test/seam-entry-abi.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveOverrides } from "../../machine.js";
import { ROUTINES } from "../names.js";
import { ORACLE_ROUTINES } from "../../routines.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

/** The five addresses whose idiomatic export is pure and therefore needs an `entry`. */
const PURE_SIGNATURE = [0x0347, 0x1783, 0x2333, 0x2ff0, 0x3009];

const RET = 0x1234; // the return address a translated caller's `push16` would carry
const SAFE_SP = 0x6bfe; // inside STACK_SCRATCH, so the bracket's bytes land on dead stack
const WORK_RAM_BASE = 0x6000;
const WORK_RAM_SIZE = 0x0c00;
/** Everything the Z80 register file holds, minus the shadow set no routine here touches. */
const ALL_REGS = ["a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "sp"];

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const MACHINE_PARAMS = new Set(["m", "mm", "machine", "_m", "_mm"]);

/** The first parameter's NAME, for the shape check. Syntactic on purpose — see the test. */
function firstParamName(fn) {
  const src = fn.toString();
  const params = src.slice(src.indexOf("(") + 1, src.indexOf(")")).trim();
  if (params === "") return "";
  return params.split(",")[0].trim().replace(/[={].*$/, "").trim();
}

// -- seeds and machines --------------------------------------------------------

/** A full register-file seed: every REG_FIELD present (copyFrom copies all of them, and a
 *  missing shadow field would land as `undefined` rather than a byte). */
function regsSeed(over = {}) {
  const r = {};
  for (const k of REG_FIELDS) r[k] = 0;
  r.sp = SAFE_SP;
  return { ...r, ...over };
}

function seedFrom(workRam, regs) {
  return { workRam, regs };
}

/**
 * A Machine with the frame machinery neutralised, exactly as `clone()` does it: an
 * `m.step` inside the oracle would otherwise trip the vblank boundary or the NMI at
 * cycle 0 and run a whole frame in the middle of a leaf.
 */
function seededMachine(seed, overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.nextBoundary = Infinity;
  m.nextNmi = Infinity;
  m.maxFrames = Infinity;
  m.maxCycles = Infinity;
  m.mem.workRam.set(seed.workRam);
  m.regs.copyFrom(seed.regs);
  return m;
}

/** Resolve ONE address the way the shipped resolvers do: module from `name`, export from
 *  `entry ?? name`. ★ NOTE THE LIMIT, so nobody over-reads this file: it RE-IMPLEMENTS that rule
 *  rather than calling resolveAllIdiomatic, so regressing the SHIPPED resolver (e.g. back to
 *  `export: meta.name`) leaves every test here green — idiomatic.test.js is what catches that.
 *  This file gates the ADAPTERS; idiomatic gates the WIRING. Neither substitutes for the other. */
function wire(addr, exportName) {
  const meta = ROUTINES[addr];
  return resolveOverrides(
    { [addr.toString(16)]: { module: `./idiomatic/${meta.name}.js`, export: exportName ?? meta.entry ?? meta.name } },
    new URL("../../machine.js", import.meta.url).href,
  );
}

/**
 * Dispatch `addr` on a seed, once through the frozen ORACLE and once through the wired
 * entry, each behind a translated caller's bracket. Returns both machines and both
 * return values.
 */
function dispatchBoth(seed, overrides, addr) {
  const o = seededMachine(seed, null);
  o.regs.sp = SAFE_SP;
  o.push16(RET);
  const ro = ORACLE_ROUTINES.get(addr)(o);

  const c = seededMachine(seed, overrides);
  c.regs.sp = SAFE_SP;
  c.push16(RET);
  const rc = c.call(addr);

  return { o, c, ro, rc };
}

/** Every way the two machines differ over `regs`, plus pc (unless waived) and RAM. */
function diffs(o, c, regs, { comparePc = true } = {}) {
  const out = [];
  for (const r of regs) if (o.regs[r] !== c.regs[r]) out.push(`${r} oracle=${hx(o.regs[r])} entry=${hx(c.regs[r])}`);
  if (comparePc && o.pc !== c.pc) out.push(`pc oracle=${hx(o.pc)} entry=${hx(c.pc)}`);
  for (let i = 0; i < o.mem.workRam.length; i++) {
    if (o.mem.workRam[i] !== c.mem.workRam[i]) {
      out.push(`RAM@${hx(WORK_RAM_BASE + i)} oracle=${hx(o.mem.workRam[i])} entry=${hx(c.mem.workRam[i])}`);
      break;
    }
  }
  return out;
}

/** A reproducible byte stream — the seeds must be identical run to run. */
function rng(state) {
  return () => ((state = (state * 1103515245 + 12345) & 0x7fffffff) >>> 8) & 0xff;
}

/**
 * ROM 0x3009's terminating domain, derived from the mechanism rather than from the
 * routine's answer: the scan rotates C right two bits per pass and stops when C's low two
 * bits equal the (possibly decremented) selector, so it returns iff one of C's four 2-bit
 * fields matches. Everything else is the ROM's own faithful hang.
 */
function terminates3009(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff;
  let c;
  let sel = b;
  if ((a & 1) === 0) {
    c = (a & 4) ? 0x6c : 0x90;
  } else {
    c = (a & 4) ? 0x1e : 0xb4;
    if (b & 4) sel = (b - 1) & 0xff;
  }
  for (let i = 0; i < 4; i++) {
    c = ror2(c);
    if ((c & 3) === sel) return true;
  }
  return false;
}

// -- 1. STRUCTURAL: the class cannot come back --------------------------------

test("STRUCTURAL: every wired ROUTINES entry resolves to a MACHINE-SHAPED export", async () => {
  // A SYNTACTIC check, stated as such: it reads the resolved export's FIRST PARAMETER NAME.
  // That is exactly the shape of this defect — a function whose first parameter is a
  // coordinate, a memory view or a register byte rather than the Machine — and it is not
  // claimed to catch anything subtler. Its teeth are the next test: each of the five PURE
  // exports must be REJECTED by it, or a green run here proves nothing.
  const bad = [];
  let checked = 0;
  for (const [key, meta] of Object.entries(ROUTINES)) {
    const addr = Number(key);
    const file = new URL(`../${meta.name}.js`, import.meta.url);
    if (!existsSync(file)) continue;
    const mod = await import(file.href);
    const name = meta.entry ?? meta.name;
    const fn = mod[name];
    if (typeof fn !== "function") {
      bad.push(`0x${addr.toString(16)} ${meta.name}: no function export "${name}"`);
      continue;
    }
    checked++;
    if (fn.constructor.name === "GeneratorFunction") continue; // the engine-driven spine
    const p = firstParamName(fn);
    if (p !== "" && !MACHINE_PARAMS.has(p)) {
      bad.push(`0x${addr.toString(16)} ${name}: first parameter is "${p}", not the Machine`);
    }
  }

  assert.deepEqual(
    bad, [],
    "these ROUTINES entries would be dispatched by the seam as fn(m) but do not take the " +
      `Machine first — give each an \`entry\` naming its ABI wrapper:\n  ${bad.join("\n  ")}`,
  );
  assert.ok(checked > 380, `expected the whole idiomatic layer checked, got ${checked}`);
  console.log(`  STRUCTURAL: ${checked} wired exports resolved, all machine-shaped`);
});

test("STRUCTURAL/TEETH: the five PURE exports are still pure, and the shape check rejects them", async () => {
  // Two claims in one. (a) The pure functions were NOT re-signatured to fix this — their
  // direct idiomatic callers and their exhaustive gates depend on the pure shape. (b) The
  // check above genuinely rejects that shape, so its green run means something.
  for (const addr of PURE_SIGNATURE) {
    const meta = ROUTINES[addr];
    assert.ok(meta.entry, `0x${addr.toString(16)} lost its \`entry\` — it would be wired pure again`);
    assert.notEqual(meta.entry, meta.name, `0x${addr.toString(16)}'s entry must name a DIFFERENT export`);
    const mod = await import(new URL(`../${meta.name}.js`, import.meta.url).href);
    assert.equal(typeof mod[meta.name], "function", `${meta.name} must still be exported`);
    assert.equal(typeof mod[meta.entry], "function", `${meta.entry} must be exported beside it`);
    const first = firstParamName(mod[meta.name]);
    assert.ok(
      !MACHINE_PARAMS.has(first),
      `${meta.name} now takes "${first}" first — if the pure function became machine-shaped the ` +
        "structural check above has lost its teeth (and its direct callers have broken)",
    );
    assert.ok(
      MACHINE_PARAMS.has(firstParamName(mod[meta.entry])),
      `${meta.entry} must take the Machine first — it is what the seam dispatches`,
    );
  }
  console.log(`  STRUCTURAL/TEETH: ${PURE_SIGNATURE.length} pure exports intact, each rejected by the shape check`);
});

// -- 2. 0x0347 — selectPlayerIndicatorColumnBase ------------------------------

test("0x0347 via m.call: register-EXACT vs the oracle over all 256 selector values", async () => {
  const overrides = await wire(0x0347);
  const next = rng(0xa347);
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  for (let i = 0; i < workRam.length; i++) workRam[i] = next();

  let n = 0;
  for (let a = 0; a < 256; a++) {
    // HL and F pre-loaded with junk, so a wrapper that forgot to write HL is caught.
    const seed = seedFrom(workRam, regsSeed({ a, f: 0xff, b: 0x5a, c: 0x5b, d: 0x5c, e: 0x5d, h: 0xde, l: 0xad, ix: 0x6104, iy: 0x6205 }));
    const { o, c } = dispatchBoth(seed, overrides, 0x0347);
    const d = diffs(o, c, ALL_REGS);
    assert.deepEqual(d, [], `selector ${hx(a)}: ${d.join("; ")}`);
    n++;
  }
  console.log(`  0x0347: ${n} dispatches through m.call — register-exact (A/F/HL/DE/BC/SP/pc/RAM)`);
});

test("0x0347/TEETH: a wrapper that returns the base in DE instead of HL is CAUGHT", async () => {
  const { selectPlayerIndicatorColumnBase } = await import("../selectPlayerIndicatorColumnBase.js");
  const twin = new Map([[0x0347, (m) => {
    m.regs.and(m.regs.a);
    m.regs.de = selectPlayerIndicatorColumnBase(m.regs.a);
  }]]);
  const seed = seedFrom(new Uint8Array(WORK_RAM_SIZE), regsSeed({ ix: 0x6100, iy: 0x6200 }));
  const { o, c } = dispatchBoth(seed, twin, 0x0347);
  assert.notDeepEqual(diffs(o, c, ALL_REGS), [], "a wrong destination register went undetected");
});

// -- 3. 0x1783 — allSlotsClear -------------------------------------------------

test("0x1783 via m.call: the caller-skip verdict + live-outs match the oracle on both arms", async () => {
  const overrides = await wire(0x1783);
  // THE TWO ARMS ARE HELD TO DIFFERENT CONTRACTS, exactly as allSlotsClear.js's seam-entry
  // header states, and the test says which is which rather than quietly comparing the
  // weaker set on both:
  //   ALL CLEAR — register-EXACT. Control continues in loc_1757, whose `inc (hl)` preserves
  //     carry, so the whole exit register file is reproduced and the whole file is checked.
  //   CALLER-SKIP — the verdict, RAM, and the registers the oracle never touches. A/B/HL/F
  //     are the dropped residuals (where the walk stopped is not recoverable from a
  //     boolean). SP/pc are waived HERE only: the skip's SECOND stack word is consumed
  //     against the GRANDPARENT's dispatch frame, which an isolated m.call cannot supply —
  //     the next test drives the real two-level chain and checks SP/pc there.
  const UNTOUCHED = ["c", "d", "e", "ix", "iy"];
  const next = rng(0x1783);

  const arms = { skip: 0, cont: 0 };
  for (let trial = 0; trial < 600; trial++) {
    const workRam = new Uint8Array(WORK_RAM_SIZE);
    for (let i = 0; i < workRam.length; i++) workRam[i] = next();
    const base = 0x6900 + (next() & 0x1f);
    const stride = 1 + (next() & 7);
    const occupied = (next() % 12) - 1; // -1 => all clear; 0..9 => that slot occupied
    let addr = base;
    for (let s = 0; s < 10; s++) { workRam[addr - WORK_RAM_BASE] = 0; addr = (addr + stride) & 0xffff; }
    if (occupied >= 0) workRam[base + occupied * stride - WORK_RAM_BASE] = 1 + (next() & 0x7f);

    const seed = seedFrom(workRam, regsSeed({
      a: next(), f: next(), b: next(), c: 0x11,
      d: (stride >> 8) & 0xff, e: stride & 0xff, // DE = the stride
      h: (base >> 8) & 0xff, l: base & 0xff, // HL = the base
      ix: 0x6100, iy: 0x6200,
    }));

    const { o, c, ro, rc } = dispatchBoth(seed, overrides, 0x1783);
    assert.equal(rc === false, ro === false, `trial ${trial}: skip verdict differs (oracle ${ro}, entry ${rc})`);
    const skip = ro === false;
    const d = diffs(o, c, skip ? UNTOUCHED : ALL_REGS, { comparePc: !skip });
    assert.deepEqual(d, [], `trial ${trial} (${skip ? "caller-skip" : "all-clear"} arm): ${d.join("; ")}`);
    if (skip) arms.skip++; else arms.cont++;
  }
  assert.ok(arms.skip > 50 && arms.cont > 50, `both arms must be exercised, got ${JSON.stringify(arms)}`);
  console.log(
    `  0x1783: 600 dispatches through m.call — ${arms.cont} all-clear (register-exact), ` +
      `${arms.skip} caller-skip (verdict + RAM + untouched registers)`,
  );
});

test("0x1783 via its REAL caller (0x1757): the caller-skip consumes BOTH stack words", async () => {
  // The two-level chain is what makes SP checkable: the grandparent's bracket, then
  // loc_1757's own `push16(0x1762); m.call(0x1783)`. On the skip arm the oracle pops the
  // 0x1762 word AND rets to the grandparent (+4); the seam reproduces that only if 0x1783
  // is in SEAM_CALLER_SKIP and a dispatch frame stands at the outer SP. Nothing but the
  // assembled two-level shape can check it — and this is 0x1783's ONLY live coverage,
  // since attract never reaches it (0 dispatches in 12000 frames).
  const overrides = await wire(0x1783);
  const OUTER_SP = 0x6bfc;
  const GRANDPARENT_RET = 0xbeef;
  // SPRITE_OBJ_BLOCK, 4-byte records — the table 0x1757 hands 0x1783 (HL = 0x6908, DE = 4,
  // measured at the dispatch). REACHING THE OCCUPIED ARM TAKES MORE THAN A NONZERO BYTE:
  // 0x1757 first runs the cull at 0x176C, which zeroes each record's +0 whenever its +3 is
  // below 0x19. A slot only survives to be seen by 0x1783 if its +3 clears that threshold.
  const RECORD = (i) => 0x6908 + i * 4 - WORK_RAM_BASE;
  const SURVIVES_CULL = 0x40; // any +3 >= 0x19

  const runPair = (occupied) => {
    const workRam = new Uint8Array(WORK_RAM_SIZE);
    if (occupied >= 0) {
      workRam[RECORD(occupied)] = 0x7f; // +0 non-zero: the slot 0x1783 must trip on
      workRam[RECORD(occupied) + 3] = SURVIVES_CULL; // +3 high enough that the cull keeps it
    }
    const seed = seedFrom(workRam, regsSeed({ ix: 0x6200, iy: 0x6200, sp: OUTER_SP }));

    const o = seededMachine(seed, null);
    o.regs.sp = OUTER_SP; o.push16(GRANDPARENT_RET); o.call(0x1757);
    const c = seededMachine(seed, overrides);
    c.regs.sp = OUTER_SP; c.push16(GRANDPARENT_RET); c.call(0x1757);
    return { o, c };
  };

  // On the CALLER-SKIP arm the oracle's residual A/B/HL/F escape 0x1757 to the
  // grandparent — allSlotsClear.js's seam entry drops them, and says so. What this test
  // owns is the STACK: both words consumed, SP and pc back where the oracle leaves them.
  const SKIP_COMPARED = ["c", "d", "e", "ix", "iy", "sp"];
  const report = [];
  for (const occupied of [-1, 0, 4, 9]) {
    const { o, c } = runPair(occupied);
    const skip = occupied >= 0;
    const d = diffs(o, c, skip ? SKIP_COMPARED : ALL_REGS);
    assert.deepEqual(d, [], `occupied slot ${occupied}: ${d.join("; ")}`);
    assert.equal(o.regs.sp, OUTER_SP, "the oracle's own chain must balance the grandparent bracket");
    assert.equal(c.regs.sp, OUTER_SP, `the seam left SP at ${hx(c.regs.sp)} — a stack word was leaked or over-popped`);
    report.push(occupied < 0 ? "clear" : `slot${occupied}`);
  }

  // TEETH: the two arms must actually do DIFFERENT work, or "identical to the oracle" is
  // vacuous — loc_1757 only writes 0x6009 = 0x40 and bumps 0x6388 when 0x1783 says all-clear.
  const clear = runPair(-1).c;
  const occupied = runPair(0).c;
  assert.notEqual(
    Buffer.from(clear.mem.workRam).toString("hex"),
    Buffer.from(occupied.mem.workRam).toString("hex"),
    "the all-clear and caller-skip arms produced identical RAM — the chain is not reaching 0x1783's decision " +
      "(check the 0x176C cull threshold: a record whose +3 is under 0x19 has its +0 zeroed before 0x1783 sees it)",
  );
  assert.equal(clear.mem.read8(0x6009), 0x40, "the all-clear arm must run 0x1757's tail (0x6009 = 0x40)");
  assert.notEqual(occupied.mem.read8(0x6009), 0x40, "the caller-skip arm must ABORT before 0x1757's tail");
  console.log(
    `  0x1783 via 0x1757: arms [${report.join(" ")}] — both stack words consumed, SP balanced at ${hx(OUTER_SP)}`,
  );
});

// -- 4. 0x2333 — snapYToGirder (THE WALL) -------------------------------------

test("0x2333 via m.call: the corrected coordinate lands in L, exactly as the oracle leaves it", async () => {
  const overrides = await wire(0x2333);
  // LIVE-OUT ONLY: L, plus every register the oracle does not touch. A/B/F are the
  // documented dead residuals (see snapYToGirder.js's seam-entry header for the call-site
  // evidence); reproducing them would mean restating the routine's branch structure inside
  // its own wrapper.
  const COMPARED = ["c", "d", "e", "h", "ix", "iy", "sp"];
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  const XS = [0x00, 0x01, 0x0e, 0x0f, 0x10, 0x11, 0x40, 0x7f, 0x80, 0x8f, 0x90, 0x97, 0x98, 0x99, 0xb0, 0xef, 0xf0, 0xff];
  const STEPS = [0x00, 0x01, 0x02, 0xff];

  let n = 0;
  let movedL = 0;
  for (const step of STEPS) {
    for (const x of XS) {
      for (let y = 0; y < 256; y++) {
        const seed = seedFrom(workRam, regsSeed({ a: 0x5a, b: step, c: 0xc3, d: 0xd4, e: 0xe5, h: x, l: y, ix: 0x6104, iy: 0x6205 }));
        const { o, c } = dispatchBoth(seed, overrides, 0x2333);
        assert.equal(
          c.regs.l, o.regs.l,
          `x=${hx(x)} y=${hx(y)} step=${hx(step)}: L oracle=${hx(o.regs.l)} entry=${hx(c.regs.l)}`,
        );
        const d = diffs(o, c, COMPARED);
        assert.deepEqual(d, [], `x=${hx(x)} y=${hx(y)} step=${hx(step)}: ${d.join("; ")}`);
        if (o.regs.l !== y) movedL++;
        n++;
      }
    }
  }
  // ★ THE ASSERTION THE ORIGINAL DEFECT WOULD FAIL. The broken wiring was invisible
  // precisely because "returned unchanged" is the oracle's own common answer — a sweep on a
  // no-op-heavy sample would have passed while the routine did nothing at all. This demands
  // the sample actually contain moves.
  assert.ok(movedL > 100, `the sweep must reach the STEPPING arms, not just the early-outs (moved on ${movedL} of ${n})`);
  console.log(`  0x2333: ${n} dispatches through m.call — L identical to the oracle, and it MOVED on ${movedL}`);
});

test("0x2333/TEETH: the ORIGINAL defect — wiring the pure function itself — is CAUGHT", async () => {
  // Not a hypothetical twin: this wires `snapYToGirder` at 0x2333 exactly as the registry
  // did before `entry` existed. If this ever stops failing, the gate has stopped watching
  // the thing it was built for.
  const broken = await wire(0x2333, "snapYToGirder");
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  const STEPPING = [[0x10, 0x30, 1], [0x20, 0x50, 1], [0x0f, 0x30, 0], [0x80, 0xf0, 1], [0x98, 0x4c, 1]];
  let caught = 0;
  for (const [x, y, step] of STEPPING) {
    const seed = seedFrom(workRam, regsSeed({ b: step, h: x, l: y, ix: 0x6100, iy: 0x6200 }));
    const { o, c } = dispatchBoth(seed, broken, 0x2333);
    if (o.regs.l !== c.regs.l) caught++;
  }
  assert.ok(
    caught > 0,
    `the pure function wired raw reproduced the oracle's L on all ${STEPPING.length} stepping cases — this gate is blind`,
  );
  console.log(`  0x2333/TEETH: the pure-wired registry is caught on ${caught}/${STEPPING.length} stepping cases`);
});

test("0x2333/TEETH: a wrapper that swaps the two coordinates is CAUGHT", async () => {
  const { snapYToGirder } = await import("../snapYToGirder.js");
  const twin = new Map([[0x2333, (m) => { m.regs.l = snapYToGirder(m.regs.l, m.regs.h, m.regs.b); }]]);
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  let caught = 0;
  for (const [x, y] of [[0x10, 0x30], [0x20, 0x50], [0x30, 0x71], [0x40, 0x93]]) {
    const seed = seedFrom(workRam, regsSeed({ b: 1, h: x, l: y, ix: 0x6100, iy: 0x6200 }));
    const { o, c } = dispatchBoth(seed, twin, 0x2333);
    if (o.regs.l !== c.regs.l) caught++;
  }
  assert.ok(caught > 0, "a swapped H/L marshalling went undetected");
});

// -- 5. 0x2FF0 — tileAddrForPixel ---------------------------------------------

test("0x2FF0 via m.call: register-EXACT vs the oracle across the (y,x) grid", async () => {
  const overrides = await wire(0x2ff0);
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  // Every y (all 32 tile rows and every in-tile offset) x every column boundary and its
  // far edge. The MARSHALLING is what is under test — a swapped y/x, a dropped rotate or a
  // lost D/E shows immediately on this grid.
  const XS = [];
  for (let col = 0; col < 32; col++) { XS.push(col * 8); XS.push(col * 8 + 7); }

  let n = 0;
  for (let y = 0; y < 256; y++) {
    for (const x of XS) {
      const seed = seedFrom(workRam, regsSeed({ a: 0x5a, f: 0xff, b: 0xb0, c: 0xc0, d: 0xd0, e: 0xe0, h: y, l: x, ix: 0x6104, iy: 0x6205 }));
      const { o, c } = dispatchBoth(seed, overrides, 0x2ff0);
      const d = diffs(o, c, ALL_REGS);
      assert.deepEqual(d, [], `y=${hx(y)} x=${hx(x)}: ${d.join("; ")}`);
      n++;
    }
  }
  console.log(`  0x2FF0: ${n} dispatches through m.call — register-exact (HL/A/DE/F/SP/pc/RAM)`);
});

test("0x2FF0/TEETH: a wrapper that swaps y and x is CAUGHT", async () => {
  const { tileAddrForPixel } = await import("../tileAddrForPixel.js");
  const twin = new Map([[0x2ff0, (m) => { m.regs.hl = tileAddrForPixel(m.regs.l, m.regs.h); }]]);
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  let caught = 0;
  for (const [y, x] of [[0x10, 0x30], [0x64, 0x08], [0x9c, 0xb8]]) {
    const seed = seedFrom(workRam, regsSeed({ h: y, l: x, ix: 0x6100, iy: 0x6200 }));
    const { o, c } = dispatchBoth(seed, twin, 0x2ff0);
    if (o.regs.hl !== c.regs.hl) caught++;
  }
  assert.ok(caught > 0, "a swapped (y,x) marshalling went undetected");
});

// -- 6. 0x3009 — the one that HUNG --------------------------------------------

test("0x3009 via m.call: TERMINATES (the hang regression) and is register-EXACT", { timeout: 180000 }, async () => {
  // The `timeout` is the point of this test, not decoration: wired pure, this address did
  // not diverge, it SPUN — its faithful non-termination fed garbage arguments, with no
  // m.step budget to backstop it. A regression must show as a FAILED test, not a hung suite.
  const overrides = await wire(0x3009);
  const workRam = new Uint8Array(WORK_RAM_SIZE);

  let n = 0;
  let skipped = 0;
  let carrySet = 0;
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 16; b++) {
      if (!terminates3009(a, b)) { skipped++; continue; }
      const seed = seedFrom(workRam, regsSeed({ a, b, c: 0xcc, d: 0xdd, e: 0xee, h: 0x77, l: 0x88, ix: 0x6104, iy: 0x6205 }));
      const { o, c } = dispatchBoth(seed, overrides, 0x3009);
      const d = diffs(o, c, ALL_REGS);
      assert.deepEqual(d, [], `a=${hx(a)} b=${hx(b)}: ${d.join("; ")}`);
      if (o.regs.fC) carrySet++;
      n++;
    }
  }
  assert.ok(n > 500, `expected a broad terminating sample, got ${n}`);
  // The CARRY is NOT known to be live — no call site is confirmed to read it (see nextAnimationStep.js
  // OUT:, where the earlier "advanceBarrelSpriteOrientation consumes it" claim is falsified by measurement). It is
  // reproduced because replaying the oracle's `cp 0x03` is free and exact, so the sample must
  // still contain BOTH settings or that FIDELITY claim would be untested.
  assert.ok(carrySet > 0 && carrySet < n, `both carry outcomes must appear (set on ${carrySet} of ${n})`);
  console.log(`  0x3009: ${n} terminating dispatches through m.call (${skipped} non-terminating skipped) — register-exact incl. CARRY (set on ${carrySet})`);
});

test("0x3009/TEETH: a wrapper that drops the CARRY replay is CAUGHT", async () => {
  const { nextAnimationStep } = await import("../nextAnimationStep.js");
  const twin = new Map([[0x3009, (m) => {
    const r = nextAnimationStep(m.regs.a, m.regs.b);
    m.regs.a = r.a; m.regs.b = r.b; m.regs.c = r.c; m.regs.d = r.d; // no `cp 0x03`: F never rebuilt
  }]]);
  const workRam = new Uint8Array(WORK_RAM_SIZE);
  let caught = 0;
  let tried = 0;
  for (let a = 0; a < 256 && tried < 32; a++) {
    if (!terminates3009(a, 0x01)) continue; // a non-terminating input would HANG, not fail
    const seed = seedFrom(workRam, regsSeed({ a, b: 0x01, ix: 0x6100, iy: 0x6200 }));
    const { o, c } = dispatchBoth(seed, twin, 0x3009);
    tried++;
    if (o.regs.f !== c.regs.f) caught++;
  }
  assert.ok(tried > 0 && caught > 0, `a dropped flag replay went undetected (${caught} of ${tried})`);
});
