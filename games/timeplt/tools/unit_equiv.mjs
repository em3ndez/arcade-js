// SPDX-License-Identifier: GPL-3.0-only
/**
 * PER-ROUTINE equivalence for Time Pilot: run ONE translated routine against the
 * state MAME had at that routine's entry, and diff the result against the state
 * MAME had at its exit.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE FRAME DIFF. The frame-boundary state diff
 * compares whole frames, so it can only say "somewhere in this frame the machine
 * went wrong", and it cannot run at all until the boot chain executes end to end.
 * Every routine in translated/ is unexecuted code until something runs it. This
 * harness runs each one in isolation from a real machine state, so a mistranslated
 * instruction is localised to a routine and to the first RAM address or register it
 * got wrong -- with no dependency on the boot chain.
 *
 * THE ORACLE IS MAME, NEVER THE JS ENGINE. Both halves of every pair come from
 * lua/unit_capture.lua running the real ROM; nothing here compares JS against JS.
 *
 * WHAT A MATCH DOES AND DOES NOT SAY. It says: on the ONE invocation captured, from
 * the registers and RAM the real machine actually held, the translation produced the
 * real machine's result. It does NOT say the routine is correct on every path.
 * A routine with a real defect on one arm comes out MATCH whenever the captured
 * invocation left through an earlier `ret cc` without reaching it; a different run,
 * whose capture happened to take that arm, catches the same defect. A MATCH is
 * evidence about a path, not a proof about a routine.
 *
 * WHAT IS COMPARED
 *   RAM   the 4608-byte state dump (colour, video, work, sprite0, sprite1). The
 *         stack lives at 0xAFxx (boot sets SP=0xB000) so pushes and pops are inside
 *         it, and every RAM address the CPU can reach is covered.
 *   REGS  AF BC DE HL IX IY SP and the shadow bank, via core/equivalence.js
 *         firstRegDiff over the CPU's own REG_FIELDS.
 *
 * THE ONE DELIBERATE OFFSET. MAME's exit sample is taken during the opcode fetch of
 * the `ret`, i.e. BEFORE it executes; the JS routine has by then already executed its
 * `ret`. So the JS side is expected to hold SP = MAME's SP + 2 and PC = the word MAME
 * had at that SP. Both are checked, rather than excluded.
 *
 * PAIR VALIDITY is enforced on the MAME side (see the Lua script: an NMI inside the
 * window, or an exit `ret` at a different stack depth, disarms and retries), and
 * re-asserted here so a capture directory produced by an older or edited script
 * cannot quietly certify a bad pair as a MATCH.
 *
 * Usage:
 *   node games/timeplt/tools/unit_equiv.mjs --cap DIR [--only 00B1,0F1A] [--json OUT]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Machine, FramesComplete, CYCLES_PER_FRAME } from "../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../core/equivalence.js";
import { REG_FIELDS } from "../../../core/cpu/z80.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.dirname(HERE);
const ROM_PATH = path.join(GAME, "rom", "maincpu.bin");

/**
 * A routine that never returns in JS would hang the harness, so every run is capped.
 * Four frames' worth of T-states is far more than any single routine costs and still
 * trips within milliseconds; the usual cause is a poll loop on a device the isolated
 * machine holds constant (the 0xC000 scanline counter), which is reported as a spin.
 */
const CYCLE_BUDGET = 4 * CYCLES_PER_FRAME;

const hex4 = (v) => (v & 0xffff).toString(16).padStart(4, "0").toUpperCase();

// -- capture loading --------------------------------------------------------

function parseMeta(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    out[k] = v.startsWith("0x") ? parseInt(v, 16) : Number(v);
  }
  return out;
}

/** MAME's register names -> this CPU model's REG_FIELDS. */
function regsFromMeta(meta) {
  const hi = (v) => (v >> 8) & 0xff;
  const lo = (v) => v & 0xff;
  return {
    a: hi(meta.reg_AF), f: lo(meta.reg_AF),
    b: hi(meta.reg_BC), c: lo(meta.reg_BC),
    d: hi(meta.reg_DE), e: lo(meta.reg_DE),
    h: hi(meta.reg_HL), l: lo(meta.reg_HL),
    ix: meta.reg_IX, iy: meta.reg_IY, sp: meta.reg_SP,
    a_: hi(meta.reg_AF2), f_: lo(meta.reg_AF2),
    b_: hi(meta.reg_BC2), c_: lo(meta.reg_BC2),
    d_: hi(meta.reg_DE2), e_: lo(meta.reg_DE2),
    h_: hi(meta.reg_HL2), l_: lo(meta.reg_HL2),
  };
}

function loadPairs(capDir) {
  const pairs = new Map();
  for (const f of fs.readdirSync(capDir)) {
    const m = /^([0-9A-F]{4})\.(entry|exit)\.bin$/.exec(f);
    if (!m) continue;
    const addr = parseInt(m[1], 16);
    const rec = pairs.get(addr) ?? { addr };
    rec[m[2]] = {
      state: new Uint8Array(fs.readFileSync(path.join(capDir, f))),
      meta: parseMeta(path.join(capDir, `${m[1]}.${m[2]}.txt`)),
    };
    pairs.set(addr, rec);
  }
  return pairs;
}

// -- routine registry -------------------------------------------------------

/**
 * Built by scanning translated/, NOT by importing routines.js. The registry file is
 * being edited concurrently by the agent doing the boot chain; reading the directory
 * keeps this harness from depending on that file's moment-to-moment state, and it
 * also picks up routines that exist but are not registered yet.
 */
async function buildRegistry(dir) {
  const reg = new Map();
  const failed = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const m = /^loc_([0-9a-f]{4})\.js$/.exec(f);
    if (!m) continue;
    const addr = parseInt(m[1], 16);
    try {
      const mod = await import(pathToFileURL(path.join(dir, f)).href);
      const fn = mod[`loc_${m[1]}`];
      if (typeof fn !== "function") { failed.push([addr, "no matching export"]); continue; }
      reg.set(addr, fn);
    } catch (e) {
      failed.push([addr, e.message.split("\n")[0]]);
    }
  }
  return { reg, failed };
}

// -- the machine under test -------------------------------------------------

/** Instrument the I/O ports so a divergence can be attributed to an unmodelled input. */
function watchIo(io) {
  const seen = { scanline: 0, in0: 0, in1: 0, in2: 0, dsw0: 0, dsw1: 0 };
  for (const [k, fn] of [
    ["scanline", "readScanline"], ["in0", "readIn0"], ["in1", "readIn1"],
    ["in2", "readIn2"], ["dsw0", "readDsw0"], ["dsw1", "readDsw1"],
  ]) {
    const orig = io[fn].bind(io);
    io[fn] = () => { seen[k]++; return orig(); };
  }
  return seen;
}

function loadState(mem, buf) {
  let o = 0;
  const take = (arr) => { arr.set(buf.subarray(o, o + arr.length)); o += arr.length; };
  take(mem.colorRam);
  take(mem.videoRam);
  take(mem.workRam);
  take(mem.sprite0);
  take(mem.sprite1);
  if (o !== buf.length) throw new Error(`state dump is ${buf.length}B, regions cover ${o}B`);
}

function makeMachine(rom, registry, entryState, entryRegs, addr) {
  const m = new Machine(rom, registry);
  loadState(m.mem, entryState);
  for (const k of REG_FIELDS) m.regs[k] = entryRegs[k];
  m.pc = addr;
  m.pcKnown = true;
  m.mem.pc = addr;
  m.nextBoundary = Infinity; // no frame sampling and no NMI inside a unit run
  m.maxFrames = 0;
  m.maxCycles = CYCLE_BUDGET;
  m.io.watched = watchIo(m.io);
  return m;
}

// -- one routine ------------------------------------------------------------

function runOne(rom, registry, rec, extents, inSpec, attempt) {
  const addr = rec.addr;
  const name = `loc_${hex4(addr).toLowerCase()}`;
  const res = { addr, name };

  const ext = extents?.[hex4(addr)];
  if (ext) {
    res.instructions = ext.instructions;
    res.tailJump = ext.tail_jumps.length > 0;
  }

  if (!registry.has(addr)) return { ...res, verdict: "NO TRANSLATION" };
  if (!inSpec) {
    return {
      ...res, verdict: "NO EXIT POINT",
      why: ext && ext.unresolved.length
        ? `no ret reachable from the entry — ${ext.unresolved[0].why}`
        : "no ret reachable from the entry",
    };
  }
  if (!rec.entry) {
    const a = attempt;
    if (!a || a.arms === 0) {
      return { ...res, verdict: "NOT REACHED", why: "entry never executed during the capture run" };
    }
    // Executed, repeatedly, but no invocation ever closed a clean window.
    const bits = [];
    if (a.nmi_aborts) bits.push(`${a.nmi_aborts} window(s) cut by an NMI`);
    if (a.sp_aborts) bits.push(`${a.sp_aborts} exit(s) at the wrong stack depth`);
    if (a.rearms) bits.push(`${a.rearms} re-entries (left through a conditional ret)`);
    return {
      ...res, verdict: "NO CLEAN WINDOW",
      why: `entered ${a.arms}x, never closed cleanly: ${bits.join(", ") || "exit ret never fired"}`,
    };
  }

  if (!rec.exit) {
    return { ...res, verdict: "PAIR INVALID", why: "entry sample with no exit sample beside it" };
  }
  const em = rec.entry.meta, xm = rec.exit.meta;
  res.exitPc = xm.exit_pc;
  res.cycles = xm.cycles - em.cycles;
  res.tries = { rearms: xm.rearms, nmiAborts: xm.nmi_aborts, spAborts: xm.sp_aborts };
  // Re-assert what the Lua side already enforced: a capture directory from an older
  // or edited script must not be able to certify a bad pair as a MATCH. The test is
  // PRESENCE, not a count -- the Lua RETRIES an aborted window, so nmi_aborts is how
  // many tries it took, and real captures carry 1 and 21. Reading it as "NMIs leaked
  // into this window" would reject two sound pairs. A capture written before the abort
  // logic existed has no such key at all, and that is the case worth refusing.
  for (const k of ["nmi_aborts", "sp_aborts", "rearms"]) {
    if (xm[k] === undefined) {
      return {
        ...res, verdict: "PAIR INVALID",
        why: `exit metadata has no ${k}: this capture predates the abort checks and ` +
          "certifies nothing. Re-run unit_equiv.sh.",
      };
    }
  }
  if (em.reg_SP !== xm.reg_SP) {
    return {
      ...res, verdict: "PAIR INVALID",
      why: `SP 0x${hex4(em.reg_SP)} at entry vs 0x${hex4(xm.reg_SP)} at the exit ret — ` +
        "the exit belongs to a different invocation",
    };
  }

  const entryRegs = regsFromMeta(em);
  const m = makeMachine(rom, registry, rec.entry.state, entryRegs, addr);

  try {
    registry.get(addr)(m);
  } catch (e) {
    if (e instanceof FramesComplete) {
      return { ...res, verdict: "SPIN", why: `did not return within ${CYCLE_BUDGET} T-states`, io: m.io.watched };
    }
    return { ...res, verdict: "THREW", why: `${e.name}: ${e.message.split("\n")[0]}`, io: m.io.watched };
  }

  res.io = m.io.watched;
  res.unmappedReads = m.mem.unmappedReads;

  const ram = firstStateDiff(m.mem.dumpState(), rec.exit.state, (o) => m.mem.stateOffsetToAddr(o));

  // MAME sampled BEFORE the ret; the JS side has executed it. Expect SP+2, and PC =
  // the word that was sitting at MAME's SP.
  const expected = regsFromMeta(xm);
  expected.sp = (xm.reg_SP + 2) & 0xffff;
  const regs = firstRegDiff(m.regs, expected);

  const retLo = rec.exit.state[stateOffsetOf(xm.reg_SP)];
  const retHi = rec.exit.state[stateOffsetOf((xm.reg_SP + 1) & 0xffff)];
  const expectedPc = retLo === undefined ? null : (retLo | (retHi << 8));
  const pcOk = expectedPc === null || m.pc === expectedPc;

  if (!ram && !regs && pcOk) {
    // A routine that changes nothing observable passes this gate no matter what the
    // translation says, so say so rather than let it inflate the MATCH list. The
    // delta is measured on the ORACLE's own two samples, not on the JS run.
    let bytes = 0;
    for (let i = 0; i < rec.entry.state.length; i++) {
      if (rec.entry.state[i] !== rec.exit.state[i]) bytes++;
    }
    const entryRegsOnly = regsFromMeta(em);
    const changedRegs = REG_FIELDS.filter((k) => entryRegsOnly[k] !== regsFromMeta(xm)[k]);
    res.delta = { ramBytes: bytes, regs: changedRegs };
    if (bytes === 0 && changedRegs.length === 0) {
      return { ...res, verdict: "MATCH (VACUOUS)", why: "the oracle's entry and exit states are identical — this routine changed nothing observable on the invocation captured, so the comparison proves nothing" };
    }
    return { ...res, verdict: "MATCH" };
  }

  const out = { ...res, verdict: "DIVERGE" };
  if (ram) {
    out.ram = { addr: ram.addr, js: ram.a, mame: ram.b };
    out.first = `RAM 0x${hex4(ram.addr)}: js=0x${ram.a.toString(16).padStart(2, "0")} ` +
      `mame=0x${ram.b.toString(16).padStart(2, "0")}`;
  } else if (regs) {
    out.reg = { reg: regs.reg, js: regs.a, mame: regs.b };
    out.first = `REG ${regs.reg}: js=0x${regs.a.toString(16)} mame=0x${regs.b.toString(16)}`;
  } else {
    out.first = `PC: js=0x${hex4(m.pc)} expected 0x${hex4(expectedPc)} (returned to the wrong place)`;
  }
  if (ram && regs) out.alsoReg = `${regs.reg}: js=0x${regs.a.toString(16)} mame=0x${regs.b.toString(16)}`;
  return out;
}

/** Dump-offset of a RAM address, or undefined when the address is not in the dump. */
function stateOffsetOf(addr) {
  if (addr >= 0xa000 && addr <= 0xa3ff) return addr - 0xa000;
  if (addr >= 0xa400 && addr <= 0xa7ff) return 0x400 + (addr - 0xa400);
  if (addr >= 0xa800 && addr <= 0xafff) return 0x800 + (addr - 0xa800);
  if (addr >= 0xb000 && addr <= 0xb0ff) return 0x1000 + (addr - 0xb000);
  if (addr >= 0xb400 && addr <= 0xb4ff) return 0x1100 + (addr - 0xb400);
  return undefined;
}

// -- main -------------------------------------------------------------------

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
}

async function main() {
  const capDir = arg("cap", path.join(GAME, "out", "units", "cap"));
  const unitsDir = path.dirname(capDir);
  const extentsPath = arg("extents", path.join(unitsDir, "extents.json"));
  const specPath = arg("spec", path.join(unitsDir, "spec.txt"));
  const only = arg("only");
  const jsonOut = arg("json");

  // --translated points the registry at a COPY of translated/. The directory is under
  // active development by another agent, so a candidate fix is proved against an
  // overlay copy rather than by editing the live files: run the harness twice, once on
  // each directory, and the difference in verdicts is the fix's actual effect.
  const translated = arg("translated", path.join(GAME, "translated"));

  const rom = new Uint8Array(fs.readFileSync(ROM_PATH));
  const { reg: registry, failed } = await buildRegistry(translated);
  const extents = fs.existsSync(extentsPath)
    ? JSON.parse(fs.readFileSync(extentsPath, "utf8")) : null;
  const pairs = loadPairs(capDir);

  // Which routines the capture run was even LOOKING for. A routine added to
  // translated/ after the capture, or one with no tappable exit, must not be
  // reported as "not reached" — that would blame attract mode for a gap in the
  // instrument.
  const spec = new Set();
  if (fs.existsSync(specPath)) {
    for (const line of fs.readFileSync(specPath, "utf8").split("\n")) {
      const m = /^([0-9A-Fa-f]{4})\s/.exec(line);
      if (m) spec.add(parseInt(m[1], 16));
    }
  }
  const attempts = new Map();
  const attemptsPath = path.join(capDir, "attempts.txt");
  if (fs.existsSync(attemptsPath)) {
    for (const line of fs.readFileSync(attemptsPath, "utf8").split("\n")) {
      const m = /^([0-9A-F]{4}) (.*)$/.exec(line.trim());
      if (!m) continue;
      const rec = {};
      for (const kv of m[2].split(/\s+/)) {
        const [k, v] = kv.split("=");
        rec[k] = Number(v);
      }
      attempts.set(parseInt(m[1], 16), rec);
    }
  }

  // Every translated routine is a subject, whether or not the capture reached it —
  // otherwise "not reached" would silently vanish from the coverage account.
  const subjects = new Set([...registry.keys(), ...pairs.keys()]);
  const filter = only ? new Set(only.split(",").map((s) => parseInt(s, 16))) : null;

  const results = [];
  for (const addr of [...subjects].sort((a, b) => a - b)) {
    if (filter && !filter.has(addr)) continue;
    results.push(runOne(rom, registry, pairs.get(addr) ?? { addr }, extents,
      spec.has(addr), attempts.get(addr)));
  }

  const by = (v) => results.filter((r) => r.verdict === v);
  const order = ["DIVERGE", "THREW", "SPIN", "MATCH", "MATCH (VACUOUS)", "PAIR INVALID",
    "NO CLEAN WINDOW", "NO EXIT POINT", "NOT REACHED", "NO TRANSLATION"];
  for (const v of order) {
    const rs = by(v);
    if (!rs.length) continue;
    console.log(`\n=== ${v} ===`);
    for (const r of rs) {
      const tag = r.tailJump ? " [tail-jump exit]" : "";
      const detail = r.first ?? r.why ?? "";
      console.log(`  ${r.name}${tag}${detail ? "  " + detail : ""}`);
      // The window is the unit that was actually tested. When a routine tail-jumps,
      // the `ret` that closes it can be a long way downstream, so a divergence found
      // here is somewhere in that whole span -- not necessarily in this file. Print
      // the span so nobody reads a wide window as a narrow accusation.
      if (r.verdict === "DIVERGE") {
        console.log(`      window: 0x${hex4(r.addr)} -> 0x${hex4(r.exitPc)}, ${r.cycles} T-states`);
      }
      if (r.alsoReg) console.log(`      also ${r.alsoReg}`);
      if (r.io) {
        const noisy = Object.entries(r.io).filter(([, n]) => n > 0);
        if (noisy.length) console.log(`      reads: ${noisy.map(([k, n]) => `${k}x${n}`).join(" ")}`);
      }
    }
  }

  console.log("\n=== tally ===");
  for (const v of order) console.log(`  ${v.padEnd(15)} ${by(v).length}`);
  if (failed.length) {
    console.log("\n=== translated files that would not import ===");
    for (const [a, why] of failed) console.log(`  loc_${hex4(a).toLowerCase()}  ${why}`);
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ results, importFailures: failed }, null, 1) + "\n");
    console.log(`\n[json] ${jsonOut}`);
  }
}

main();
