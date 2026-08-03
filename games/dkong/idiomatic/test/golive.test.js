// SPDX-License-Identifier: GPL-3.0-only
//
// golive — the Donkey Kong go-live gates. Tests 1 and 2 run the ASSEMBLED game under the cycle-free
// coroutine engine (core/frame-stepped.js runGeneratorGame) and compare it against the pure-
// translated oracle run under runCycleFree with the SAME frame boundary — the vblank wait at ROM
// 0x02BD — so both runs cross vblank at the same logical point. Test 3 runs no game at all (it is a
// structural check on the Machine) and test 4 runs only the oracle. ROM-guarded (skips without the
// BYO ROM). FOUR tests, each exercising something different; read this list before trusting a green
// run, because two of them are deliberately narrow:
//
//   1. "the idiomatic spine reproduces the translated oracle"
//      Wires exactly ONE override: the boot generator at 0x0000, which delegates into the mainLoop
//      generator with `yield*`. Everything else — the vblank NMI, every leaf — stays TRANSLATED.
//      Coverage claim, stated exactly because it is easy to overstate: this proves the idiomatic
//      control SPINE drives the assembled game and reproduces the oracle over 600 attract frames.
//      It contains ZERO translated->idiomatic leaf transitions (the engine enters the generator
//      directly and opens no call bracket), so it says NOTHING about the layer seam. It could not
//      have caught, and did not catch, the seam's return-address leak; test 2 is what covers that.
//
//   2. "the FULL FLIP: all idiomatic routines live, guest stack balanced every frame"
//      Wires resolveAllIdiomatic() — every routine in idiomatic/ram.js ROUTINES — which is the
//      configuration web/worker.js ships and the only one that exercises the translated->idiomatic
//      SEAM. Asserts, per vblank yield: SP equals the previous yield's, and SP never falls below
//      the STACK_SCRATCH floor the state-diff exclusion assumes; plus that the vblank NMI subtree
//      is stack-neutral on its own, and that the flip still reproduces the oracle on every live
//      cell. Also asserts the run REACHES its frame budget, which "green" did not previously imply:
//      before the seam fix this run died at frame 237 and no test failed.
//
//      ★★ KNOWN COVERAGE BOUNDARY — this gate is SP-BLIND INSIDE THE NMI SUBTREE, and that limit is
//      measured, not suspected. The SP assertion samples at the vblank YIELD, i.e. at frame
//      boundaries. `perFrame`'s epilogue forces SP = frameBase + 12 before that point, so any stack
//      delta introduced INSIDE the NMI subtree is absorbed before the gate ever looks.
//      THE EVIDENCE, non-vacuous: idiomatic loc_07cb's FINISH arm returns before the oracle leaf
//      loc_3f24 supplies a +2, so wiring it into runAttractState's slot 6 produces a REAL 2-byte
//      delta in the SHIPPED configuration — and this gate reports spFaults=0. It was caught only by
//      replaying equivalence-073c's own captures at STRIDE 1 (1 mismatch in 3990; the routine's
//      stride-16 sampling steps over the single frame that differs).
//      ★ AN EARLIER VERSION OF THIS PARAGRAPH cited a different injection (swapping
//      dispatchEffectState's loc_1e4a import) as passing "THREE gates". That citation was itself
//      vacuous and is withdrawn: under this test's config that routine takes state 2 ZERO times in
//      20000 frames, and `swap_check --all` at the quoted 3000-frame budget never dispatches it
//      either (it does at 6000, and is still TRANSPARENT). Only equivalence-1dbd genuinely drove the
//      swapped code. A gate that never executes the change is not a gate that failed to catch it.
//      So: "guest stack balanced every frame" means balanced AT THE FRAME BOUNDARY. Do not read a
//      green run here as a stack proof for ANY subtree — including the main-loop/task subtree: the
//      0x0F56 dissolve in this same commit was once described as "proven safe" that way, and that
//      was false (all 3 of its invocations are inNmi=true; injecting a delta there passes 4/4).
//      For a stack question, measure the call site in situ; this gate does not answer it.
//      Its budget is 6000. That WAS a wall (the pure-signature wiring class, at frame 710); it is now
//      a review decision — see FLIP_FRAMES for the measured headroom and why the number stands.
//
//   3. "with no overrides the seam is not installed at all"
//      A STRUCTURAL proof, not a numeric one: a Machine built with an empty override map carries no
//      own push16/pop16/call, so the pure-oracle path — every oracle suite and every convergence
//      baseline, including the `runOracle` side of tests 1 and 2 — runs the identical prototype
//      methods it always did. It says NOTHING about the SHIPPED player, which is an
//      overridden Machine (manifest.runtime === "idiomatic"); test 2 is that one. Carries its own
//      teeth case (the properties MUST appear once an override is wired).
//
//   4. "the seam's stack-effect tables still match the frozen oracle"
//      Re-derives machine.js's SEAM_CALLER_SKIP / SEAM_TAIL_NO_RET from an instrumented pure-oracle
//      run and diffs them against the committed tables, so the seam cannot drift away from the
//      oracle it models. Coverage claim: the ATTRACT sequence only — it checks every table entry
//      the attract run actually reaches and reports the count; entries it never reaches are NOT
//      checked and the test says so rather than implying otherwise.
//
// THE MEMORY-EQUIVALENCE CONTRACT the comparisons use: byte-for-byte on every LIVE cell of the
// dumped state — work RAM 0x6000-0x6BFF, sprite RAM 0x7000-0x73FF, video RAM 0x7400-0x77FF
// (the rendered output) — excluding only the dead stack scratch [0x6BE0, 0x6C00), where a
// direct-called idiomatic leaf simply never writes the oracle's transient push16/ret bytes. That
// exclusion is sound only while SP stays at or above the scratch floor, which is exactly what test
// 2's second assertion now proves instead of assuming.
//
// COVERAGE SCOPE (every test here): the ATTRACT sequence, whose task handlers all ret promptly to
// 0x02BD (one yield per frame). GAMEPLAY is NOT covered — a gameplay handler could itself wait for
// vblank and would need its own yield. Before wiring gameplay leaves under these gates, add a
// gameplay input-tape run (see manifest.convergence). The three main-loop paths (dispatch, fZ-spin
// once, new-frame) ARE all hit by attract.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  Machine, resolveOverrides, resolveAllIdiomatic, SEAM_CALLER_SKIP, SEAM_TAIL_NO_RET,
} from "../../machine.js";
import manifest from "../../manifest.js";
import { installEntropyPin } from "../../../../core/entropy-pin.js";
import { runGeneratorGame, runCycleFree } from "../../../../core/frame-stepped.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const FRAMES = 600; // enough to boot and run the attract sequence

// The full flip's budget is 700, and the reason it is not higher is a REAL DEFECT, not a safety
// margin. Two blockers have fallen in turn, each one exposing the next:
//   frame 599 — `translated/loc_3e99.js:66` invoked ROM 0x3EC3 as `m.call(0x3ec3)` with no second
//     argument while `countObjectOverlaps` destructures one. FIXED by wiring an idiomatic loc_3e99.
//   frame 607 — a live-cell divergence in one OBJ_ARRAY_67 record and its mirrored sprite. FIXED
//     by 0x2A2F, which returned a JS boolean without writing `regs.a` while both its callers are
//     still translated and read the verdict out of the accumulator (`and a / jp nz` at
//     translated/loc_2053.js and loc_20ec.js). Bisected: 0x2A2F alone clears frame 607.
//     0x298C had the SAME defect and was fixed alongside it — its single caller
//     translated/loc_3202.js uses `cp 0x01` rather than `and a / jp nz` — but on its own it does
//     NOT clear 607; it is a correctness fix, not the one that moved this wall.
//     A dropped register live-out at a translated-caller boundary — invisible to a per-routine gate
//     that compares RAM and the oracle's residual A, but never checks the value lands where the
//     caller looks.
//   frame 710 — the PURE-SIGNATURE WIRING CLASS: `snapYToGirder` (0x2333) is a PURE function
//     `(x, y, step)` registered at a ROM address. The seam dispatches it as `fn(m)`, so `x` is the
//     Machine and the rest `undefined`; `x % 16` is NaN and it silently degrades to a no-op that
//     happens to match the oracle's frequent early-out. Over a 1500-frame run the oracle moves L
//     on 71 of 1301 dispatches; the wired idiomatic version moves it on 0 of 1146. (The zero is the
//     load-bearing half; the dispatch counts differ between the two runs and are quoted with their
//     budget so they can be re-derived.) It was a CLASS, not one routine: five ROUTINES entries
//     exported non-machine signatures, and 0x3009 hung the process outright when dispatched that way.
//     FIXED by the `entry` field in idiomatic/ram.js: each of the five now names a machine-shaped ABI
//     wrapper beside its pure function, and the resolvers take the export from `entry ?? name`
//     (machine.js resolveAllIdiomatic, tools/swap_check.mjs). Gate:
//     idiomatic/test/seam-entry-abi.test.js, which dispatches every one of them through
//     `m.call(ADDR)` — the path that was broken — and carries the pure-wired registry as its teeth.
//
// ★ THIS BUDGET IS NOW A COVERAGE CHOICE, NOT A DEFECT. With that class fixed there is no known
// wall at any budget. Raised to 6000 on measurement, by the lead, on review — not as a side effect
// of the fix: the full flip under runGeneratorGame was compared live-cell against the oracle for
// 6000 frames with ZERO divergences and SP pinned at 0x6C00 on every frame (distinct SP values
// observed: exactly one), and `swap_check --all` is TRANSPARENT to 12000. 6000 costs ~0.6s against
// ~0.26s at 700, so the coverage is nearly free; raise it further if a defect is ever suspected to
// live deeper. If you ever LOWER it, say why in the same breath — and never lower it to make a
// failure go away.
//
// ★ WHY THIS TEST EXISTS. All three blockers above were invisible to per-routine equivalence gates:
// a leaked stack word, a register live-out dropped at the layer boundary, and an ABI mismatch at the
// dispatch seam are properties of the SEAM, not of any routine in isolation. Every one of those
// routines passed its own gate while the assembled game was wrong. This test, and swap_check, are
// the only things that see them.
const FLIP_FRAMES = 6000;

const { pollPCs, stateExclude, golive } = manifest.convergence;
const { nmiReturnPC } = golive;
const [STACK_LO, STACK_HI] = stateExclude.stack; // dead stack scratch, excluded (memory-equivalence)
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;

/** Byte offsets of the LIVE state cells — everything outside the dead stack scratch. */
function liveOffsets(bytesPerFrame) {
  const probe = new Machine(ROM, {});
  const keep = [];
  for (let o = 0; o < bytesPerFrame; o++) {
    const a = probe.stateOffsetToAddr(o);
    if (!(a >= STACK_LO && a < STACK_HI)) keep.push(o);
  }
  return { keep, probe };
}

/** The pure-translated oracle under runCycleFree, sampled at the same 0x02BD vblank wait. */
function runOracle(frames) {
  const mt = new Machine(ROM, {});
  installEntropyPin(mt, manifest.entropyPin);
  const tr = [];
  const rt = runCycleFree(mt, {
    pollPCs, maxFrames: frames, stepBudget: frames * 200000,
    onFrame: (m) => tr.push(Buffer.from(m.dumpState())),
  });
  assert.equal(rt.stopError, null, `translated oracle run errored: ${rt.stop}`);
  return tr;
}

test("the idiomatic spine reproduces the translated oracle (coroutine go-live)", async () => {
  // Wire the idiomatic control spine live: the boot generator (0x0000) is the entry; it delegates
  // into the mainLoop generator with `yield*` (idiomatic/boot.js imports it directly), so mainLoop
  // needs no registry override — an override at 0x02BD would be inert here, and m.call of a
  // generator returns an undriven generator (a silent no-op), so it is deliberately NOT registered.
  // The vblank NMI and every leaf routine stay translated in THIS test; the full flip is test 2.
  const overrides = await resolveOverrides({
    "0": { module: "./idiomatic/boot.js", export: "boot" },
  });

  // Idiomatic run under the coroutine engine. Pin the spin-counter RNG (both runs) so the cycle-free
  // and poll-PC engines agree on the RNG — with the pin, every LIVE cell (incl. the 0x6019 counter)
  // reproduces byte-for-byte; only the dead stack scratch is excluded (see the comparison below).
  const mi = new Machine(ROM, { overrides });
  installEntropyPin(mi, manifest.entropyPin);
  const idi = [];
  const ri = runGeneratorGame(mi, {
    bootAddr: 0x0000,
    nmiReturnPC,
    maxFrames: FRAMES,
    onFrame: (m) => idi.push(Buffer.from(m.dumpState())),
  });
  assert.equal(ri.stopError, null, `idiomatic run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `idiomatic run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);

  const tr = runOracle(FRAMES);
  assert.equal(idi.length, tr.length, "frame counts differ between idiomatic and translated");

  // Compare the whole dumped state EXCEPT the dead stack scratch [STACK_LO, STACK_HI). This is the
  // memory-equivalence contract (manifest.convergence.stateExclude): idiomatic leaves are
  // DIRECT-called, so the oracle's transient push16/ret bytes below SP are never written — dead,
  // never read as data — while every LIVE cell must still match byte-for-byte.
  const { keep, probe } = liveOffsets(tr[0].length);
  assert.ok(keep.length > 0, "no live-state bytes selected to compare");

  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(
          `frame ${i}: idiomatic spine diverged from translated at ${hex(probe.stateOffsetToAddr(o))} ` +
            `(idiomatic ${idi[i][o]} vs translated ${tr[i][o]})`,
        );
      }
    }
  }
});

test("the FULL FLIP: all idiomatic routines live, guest stack balanced every frame", async () => {
  // THE CONFIGURATION THAT SHIPS. resolveAllIdiomatic() wires every routine in ROUTINES as an
  // override — the same call web/worker.js makes — which is the ONLY configuration that exercises
  // the translated->idiomatic seam: a frozen translated caller emits `push16(RET)` before its
  // `m.call`, and the idiomatic callee models the Z80 `ret` as a JS `return`. Nothing in the test
  // suite ran this before, which is why a 12-14 byte per-frame guest-stack leak shipped undetected
  // until SP walked into the task ring at 0x60C0 and the game died on dispatched stack garbage.
  const overrides = await resolveAllIdiomatic();
  assert.ok(overrides.size > 300, `expected the whole idiomatic layer wired, got ${overrides.size}`);

  const mi = new Machine(ROM, { overrides });
  installEntropyPin(mi, manifest.entropyPin);

  // Belt and braces on top of the per-frame check: the vblank NMI subtree must be stack-neutral on
  // its own. This localises a fault to the NMI chain instead of only showing up as a frame-boundary
  // delta, and it is a tighter net — before the seam fix the NMI epilogue's six register `pop`s
  // restored orphaned return addresses into IY/IX/HL/DE/BC on EVERY frame.
  const nmiFaults = [];
  const realFire = mi.fireNmi.bind(mi);
  mi.fireNmi = function () {
    const before = mi.regs.sp;
    realFire();
    if (mi.regs.sp !== before) nmiFaults.push(`${hex(before)} -> ${hex(mi.regs.sp)}`);
  };

  const idi = [];
  let prevSp = null;
  const spFaults = [];
  const floorFaults = [];
  const ri = runGeneratorGame(mi, {
    bootAddr: 0x0000,
    nmiReturnPC,
    maxFrames: FLIP_FRAMES,
    onFrame: (m, frame) => {
      idi.push(Buffer.from(m.dumpState()));
      // Frame 0 is the power-on sample, taken before a single instruction runs — SP is still 0
      // there and boot's `ld sp,0x6c00` has not happened yet, so the invariant starts at frame 1.
      if (frame === 0) return;
      const sp = m.regs.sp;
      // THE ASSERTION. The main loop's vblank yield is a fixed point of the guest's stack
      // discipline — the pure oracle holds SP at 0x6C00 there on every frame — so any unbalanced
      // push/pop anywhere in the frame shows as a non-zero delta on the FIRST frame it happens.
      if (prevSp !== null && sp !== prevSp) {
        spFaults.push(`frame ${frame}: ${hex(prevSp)} -> ${hex(sp)}`);
      }
      // ...and this makes the STACK_SCRATCH exclusion SELF-POLICING: excluding [0x6BE0,0x6C00) from
      // the state diff is sound only while SP stays above the floor, so the gate now proves its own
      // premise instead of assuming it.
      if (sp < STACK_LO) floorFaults.push(`frame ${frame}: SP ${hex(sp)}`);
      prevSp = sp;
    },
  });

  // A leak repeats every frame, so print the first few and the count rather than 500 lines: the
  // FIRST entry is the diagnosis (which frame it started on and in which direction), the count is
  // the severity.
  const brief = (xs) => (xs.length <= 6 ? xs.join("; ") : `${xs.slice(0, 6).join("; ")} … (${xs.length} in all)`);

  assert.equal(
    spFaults.length, 0,
    "guest SP moved across a frame boundary — an unbalanced push/pop at the translated/idiomatic " +
      "seam (a translated caller's push16 that no idiomatic callee consumed, or an over-pop): " +
      brief(spFaults),
  );
  assert.equal(
    floorFaults.length, 0,
    `SP fell below the STACK_SCRATCH floor ${hex(STACK_LO)}: the state-diff exclusion ` +
      `[${hex(STACK_LO)},${hex(STACK_HI)}) is no longer sound — ${brief(floorFaults)}`,
  );
  assert.equal(nmiFaults.length, 0, `the vblank NMI subtree changed SP: ${brief(nmiFaults)}`);

  // COVERAGE, ASSERTED. "It died at frame 237" was not previously a test failure at all; these two
  // are what make a truncated run red instead of quietly short.
  assert.equal(ri.stopError, null, `full flip errored: ${ri.stop}`);
  assert.ok(
    ri.frames >= FLIP_FRAMES,
    `full flip covered only ${ri.frames}/${FLIP_FRAMES} frames (${ri.stop})`,
  );

  // And the flip must still BE the oracle on every live cell, not merely stack-balanced.
  const tr = runOracle(FLIP_FRAMES);
  assert.equal(idi.length, tr.length, "frame counts differ between the full flip and the oracle");
  const { keep, probe } = liveOffsets(tr[0].length);
  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(
          `frame ${i}: the full flip diverged from translated at ${hex(probe.stateOffsetToAddr(o))} ` +
            `(flip ${idi[i][o]} vs translated ${tr[i][o]})`,
        );
      }
    }
  }
});

test("with no overrides the seam is not installed at all (the oracle path is untouched)", () => {
  // The seam's whole licence to exist is that it CANNOT affect a Machine with no overrides — every
  // oracle suite and every convergence baseline is on that path, including `runOracle` above
  // (`new Machine(ROM, {})`), i.e. the reference side of every comparison in this file. Asserting
  // "the numbers still match" would prove it only for the cases we happen to run. This proves it
  // STRUCTURALLY: with an empty override map the Machine carries no own push16/pop16/call at all,
  // so those calls resolve to the same prototype methods they always did.
  //
  // ★ WHAT THIS TEST DOES *NOT* COVER: THE SHIPPED PLAYER. It does not run on this path.
  // games/dkong/manifest.js sets `runtime: "idiomatic"`, and web/worker.js branches on exactly that
  // (`const idiomatic = manifest.runtime === "idiomatic"`), handing in
  // `machineMod.resolveAllIdiomatic(...)` — the FULL override map, seam installed, every frame the
  // player runs. The shipped configuration is therefore the one test 2 wires (the same
  // `resolveAllIdiomatic()`), and test 2 is the only gate that covers it. Read this test for what
  // it is: the guarantee that no-override Machines — the ORACLES the other gates measure against —
  // stay the untouched prototype path, so the seam cannot quietly move the reference too.
  for (const opts of [{}, { overrides: {} }, { overrides: new Map() }]) {
    const m = new Machine(ROM, opts);
    assert.equal(m.overrides.size, 0, "expected an empty override map");
    for (const name of ["push16", "pop16", "call"]) {
      assert.equal(
        Object.hasOwn(m, name), false,
        `Machine built with ${JSON.stringify(Object.keys(opts))} shadows ${name} — the seam was ` +
          "installed on a machine with no overrides, so the pure-oracle path is no longer the " +
          "untouched prototype path",
      );
      assert.equal(m[name], Machine.prototype[name], `${name} is not the prototype method`);
    }
  }

  // TEETH: the same three properties MUST be shadowed once an override exists, or the check above
  // would pass for a machine that simply never installs the seam.
  const wired = new Machine(ROM, { overrides: { "141": (mm) => mm } });
  assert.equal(wired.overrides.size, 1);
  for (const name of ["push16", "pop16", "call"]) {
    assert.equal(Object.hasOwn(wired, name), true, `expected the seam to shadow ${name} when wired`);
  }
});

test("the seam's stack-effect tables still match the frozen oracle", async () => {
  // machine.js's seam models two facts ABOUT THE ORACLE: which routines consume TWO stack words on
  // a `false` return (the caller-skip idiom), and which `jp`-tail targets consume NONE because
  // their oracle twin never rets. Both are committed tables, and a committed table can rot. This
  // re-derives them by instrumenting a pure-oracle run and diffs, so a `translated/` change that
  // moved a routine between classes fails HERE rather than as a mystery SP drift in test 2.
  const m = new Machine(ROM, {});
  installEntropyPin(m, manifest.entropyPin);

  // Mirror the seam's own adjacency rule: a translated `call` is emitted as
  // `push16(RET); step(...); call(T)`, a `jp` tail as a bare `call(T)`.
  let lastPushSp = -1;
  const basePush = m.push16.bind(m);
  const basePop = m.pop16.bind(m);
  const baseCall = m.call.bind(m);
  m.push16 = (v) => { basePush(v); lastPushSp = m.regs.sp; };
  m.pop16 = () => { lastPushSp = -1; return basePop(); };

  const seen = new Map(); // addr -> { plain:Set<delta>, skip:Set<delta>, tail:Set<delta> }
  const bucket = (addr) => {
    if (!seen.has(addr)) seen.set(addr, { plain: new Set(), skip: new Set(), tail: new Set() });
    return seen.get(addr);
  };
  m.call = (addr, ...args) => {
    const sp0 = m.regs.sp;
    const opened = lastPushSp === sp0;
    const r = baseCall(addr, ...args);
    const delta = ((m.regs.sp - sp0) << 16) >> 16;
    const b = bucket(addr);
    (r === false ? b.skip : b.plain).add(delta);
    if (!opened) b.tail.add(delta);
    return r;
  };

  const frames = 600;
  const res = runCycleFree(m, {
    pollPCs, maxFrames: frames, stepBudget: frames * 200000, onFrame: () => {},
  });
  assert.equal(res.stopError, null, `instrumented oracle run errored: ${res.stop}`);

  // ONLY ROUTINES WITH AN IDIOMATIC TWIN CAN EVER BE WRAPPED, so only they are in scope. An
  // address with no entry in ROUTINES (0x30FA was the example here until it was wired) is never an
  // override and the seam never sees it.
  const { ROUTINES } = await import("../ram.js");
  const overridable = (a) => Object.hasOwn(ROUTINES, String(a));

  // AND only routines whose ordinary return consumes exactly ONE bracket, which is the shape the
  // seam's default models. 0x0028 is the counter-example worth naming: the `rst 0x28` trampoline
  // consumes FOUR words normally (its own `pop hl` of the table base plus the dispatched target's
  // `ret` of the continuation) and six on a skip. Its idiomatic twin performs that `pop hl` itself,
  // so the wrapper's "did the body leave SP alone?" guard already declines and neither table
  // applies. Filtering on the observed one-bracket shape keeps this check about what the tables
  // actually decide.
  const oneBracket = (b) => b.plain.size === 1 && b.plain.has(2);
  const list = (xs) => [...xs].sort((a, b) => a - b).map(hex).join(" ");

  const skipObserved = [];
  const skipContradicted = [];
  const tailZero = [];
  const tailRet = [];
  for (const [addr, b] of seen) {
    if (!overridable(addr)) continue;
    if (b.skip.size && (oneBracket(b) || b.plain.size === 0)) {
      if ([...b.skip].some((d) => d >= 4)) skipObserved.push(addr);
      else skipContradicted.push(addr);
    }
    if (b.tail.size) {
      if ([...b.tail].every((d) => d === 0)) tailZero.push(addr);
      else if ([...b.tail].every((d) => d !== 0)) tailRet.push(addr);
    }
  }

  // (a) Nothing the oracle skips two words on may be missing from the table — that is a 2-byte
  //     leak per skip at the seam.
  const missingSkip = skipObserved.filter((a) => !SEAM_CALLER_SKIP.has(a));
  assert.deepEqual(
    missingSkip.map(hex), [],
    "the oracle consumes TWO stack words on these routines' `false` return but they are absent " +
      `from SEAM_CALLER_SKIP in games/dkong/machine.js: ${list(missingSkip)}`,
  );
  // (b) Nothing in the table may be observed consuming only one — that is an over-pop.
  const wrongSkip = skipContradicted.filter((a) => SEAM_CALLER_SKIP.has(a));
  assert.deepEqual(
    wrongSkip.map(hex), [],
    "SEAM_CALLER_SKIP claims these consume two words on `false`, but the oracle consumed one: " +
      `${list(wrongSkip)}`,
  );
  // (c)/(d) the same two directions for the `jp`-tail table.
  const missingTail = tailZero.filter((a) => !SEAM_TAIL_NO_RET.has(a));
  assert.deepEqual(
    missingTail.map(hex), [],
    "these `jp`-tail targets consume NO stack word in the oracle but are absent from " +
      `SEAM_TAIL_NO_RET, so the seam would over-pop for them: ${list(missingTail)}`,
  );
  const wrongTail = tailRet.filter((a) => SEAM_TAIL_NO_RET.has(a));
  assert.deepEqual(
    wrongTail.map(hex), [],
    `SEAM_TAIL_NO_RET claims these never ret, but the oracle consumed a word: ${list(wrongTail)}`,
  );

  // COVERAGE, STATED RATHER THAN IMPLIED (this is the half a "table matches" claim usually hides).
  // The attract run reaches only some of each table; the rest are asserted by NOTHING here.
  const skipSeen = [...SEAM_CALLER_SKIP].filter((a) => skipObserved.includes(a));
  const tailSeen = [...SEAM_TAIL_NO_RET].filter((a) => tailZero.includes(a));
  assert.ok(
    skipSeen.length > 0 && tailSeen.length > 0,
    "no table entry was reached at all — this check would be vacuous; the attract run must " +
      "exercise at least one caller-skip and one non-returning `jp` tail",
  );
  // Non-vacuous but PARTIAL, and the numbers say by how much. SEAM_CALLER_SKIP's unreached entries
  // are gameplay-only guards (0x1783/0x1A2A/0x1E85/0x2257/0x236E/0x2913/0x2B74/0x2B91/0x311B/
  // 0x3126/0x3131/0x33A1 — twelve as of decompile batch 3, which added 0x33A1); they are
  // justified in machine.js from the frozen oracle's source, not here.
  assert.equal(
    tailSeen.length, SEAM_TAIL_NO_RET.size,
    "every SEAM_TAIL_NO_RET entry is reached by attract, so a shortfall means the board-layout " +
      "walk changed shape",
  );
});
