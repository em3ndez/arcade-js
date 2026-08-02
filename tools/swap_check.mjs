// SPDX-License-Identifier: GPL-3.0-only
/**
 * swap_check — the ASSEMBLED-GAME transparency gate for rolling idiomatic routines into the
 * runtime. Runs the game cycle-free TWICE — baseline (pure translated) and test (with the
 * chosen idiomatic routines wired LIVE through the override seam) — and diffs the per-frame
 * RAM state. A memory-equivalent routine is a TRANSPARENT swap: wiring it live must change
 * nothing, so the two runs are byte-for-byte identical.
 *
 * WHY THIS EXISTS. The per-routine equivalence tests (idiomatic vs translated on captured
 * states, isolated) are necessary but NOT sufficient — a routine can pass in isolation and
 * still break the assembled game through the calling convention (copyTileColumn: correct in
 * isolation, but the live translated caller passed IX in a register while the idiomatic
 * signature read a JS param → it wrote 0). Only running the whole game with the swap live
 * catches that. This is the whole-game half of the migration gate; convergence.mjs (vs MAME)
 * is the other half.
 *
 * It also reports a DISPATCH COUNT per wired routine: a "match" that comes from a routine
 * that never ran in the scenario is vacuous, so a 0-count is flagged, not silently passed.
 *
 * CONSTRUCTION CONTRACT — a game is only checkable here if its machine.js exports
 * `static async Machine.create(rom, opts)`. This tool calls it, and a game without it does not
 * fail a check, it fails to RUN: `--game dkong` died on `TypeError: Machine.create is not a
 * function` at the first line of runOne, so DK had never once been through this gate despite
 * being listed as covered by it. Recorded here so the next game added is wired for it up front.
 *
 * Usage:
 *   node tools/swap_check.mjs --game thepit [--frames 720] [--all | --routines 0x1234,0x5678]
 *   (default: whatever is in manifest.optimized)
 *
 * Exit 0 = transparent (identical), 1 = a wired swap changed the assembled run, 2 = usage/IO.
 * NOTE a length mismatch also reports as DIVERGED: read the "run coverage" line first — a test run
 * that stopped early has a real error to fix before its RAM diff means anything.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { runCycleFree } from "../core/frame-stepped.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);

function parseArgs(argv) {
  const a = { frames: 720, mode: "manifest" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--game") a.game = argv[++i];
    else if (k === "--frames") a.frames = parseInt(argv[++i], 10);
    else if (k === "--all") a.mode = "all";
    else if (k === "--leaves") a.mode = "leaves";
    else if (k === "--routines") { a.mode = "list"; a.list = argv[++i].split(",").map((s) => parseInt(s, 16)); }
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  if (!a.game) { console.error("need --game"); process.exit(2); }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gameDir = join(REPO, "games", args.game);
  const manifest = (await import(join(gameDir, "manifest.js"))).default;
  const cfg = manifest.convergence;
  if (!cfg?.pollPCs) { console.error(`games/${args.game}/manifest.js has no convergence.pollPCs`); process.exit(2); }
  const { Machine, resolveOverrides } = await import(join(gameDir, "machine.js"));
  const { ROUTINES } = await import(join(gameDir, "idiomatic", "ram.js"));

  const romDir = join(gameDir, "rom");
  const romPath = join(romDir, "maincpu.bin");
  if (!existsSync(romPath)) { console.error(`ROM not present at ${romPath} (BYO)`); process.exit(2); }
  const rom = new Uint8Array(readFileSync(romPath));

  // Build the override spec: manifest.optimized, or the whole idiomatic layer, or a list.
  let spec;
  if (args.mode === "all" || args.mode === "leaves") {
    spec = {};
    for (const [addr, meta] of Object.entries(ROUTINES)) {
      const a = Number(addr);
      const file = join(gameDir, "idiomatic", `${meta.name}.js`);
      if (!existsSync(file)) continue;
      // --leaves: only routines that call nothing (no m.call). A leaf can't spin the engine;
      // at worst it mis-reads the register ABI its translated caller passes, which the diff
      // catches. Non-leaves (routines that call others) can spin and go in later, bottom-up.
      if (args.mode === "leaves" && /\bm\.call\(/.test(readFileSync(file, "utf8"))) continue;
      spec[a.toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.name };
    }
  } else if (args.mode === "list") {
    spec = {};
    for (const a of args.list) {
      const meta = ROUTINES[a];
      if (!meta) { console.error(`0x${a.toString(16)} not in ROUTINES`); process.exit(2); }
      spec[a.toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.name };
    }
  } else {
    spec = manifest.optimized || {};
  }
  // The POLL routines (the ones containing a poll PC) must stay TRANSLATED: the frame-stepped
  // engine detects the frame boundary via m.step reaching a poll PC, and idiomatic routines
  // are cycle-free and never call m.step — wire them and frame detection dies (an idiomatic
  // spin the m.step backstop can't even catch). Full-idiomatic INCLUDING these needs the
  // serviceFrame-yield engine, not runCycleFree; until then they are the last to convert.
  const starts = Object.keys(ROUTINES).map(Number).sort((a, b) => a - b);
  const containing = (pc) => { let r = -1; for (const s of starts) { if (s <= pc) r = s; else break; } return r; };
  const pollRoutines = [...new Set(cfg.pollPCs.map(containing).filter((a) => a >= 0))];
  const excludedPoll = pollRoutines.filter((a) => spec[a.toString(16)]);
  for (const a of pollRoutines) delete spec[a.toString(16)];
  const nWired = Object.keys(spec).length;
  const baseUrl = new URL("machine.js", `file://${gameDir}/`).href;
  const overridesRaw = await resolveOverrides(spec, baseUrl);

  // Wrap each override with a dispatch counter so a vacuous (never-ran) swap is visible.
  const counts = new Map();
  const overrides = new Map();
  for (const [addr, fn] of overridesRaw) {
    counts.set(addr, 0);
    overrides.set(addr, (m, ...rest) => { counts.set(addr, counts.get(addr) + 1); return fn(m, ...rest); });
  }

  const runOne = async (ovr) => {
    const m = await Machine.create(rom, ovr ? { overrides: ovr } : {});
    const frames = [];
    // Budget scaled to the run: ~650 steps/frame observed on the attract, so 20000/frame is
    // ~30x headroom — a real run finishes well under it, a spun swap trips it in seconds.
    const r = runCycleFree(m, {
      pollPCs: cfg.pollPCs, maxFrames: args.frames, stepBudget: args.frames * 20000,
      onFrame: (mm) => frames.push(Buffer.from(mm.dumpState())),
    });
    return { frames, r };
  };

  const base = await runOne(null);
  const test = await runOne(overrides);

  const label = args.mode === "all" ? "ALL idiomatic" : args.mode === "list" ? `${nWired} listed` : "manifest.optimized";
  console.log(`swap_check [${args.game}]: ${label} — ${nWired} routine(s) wired live, ${args.frames}-frame cycle-free run`);
  if (excludedPoll.length) console.log(`  (kept poll routines translated — required by runCycleFree: ${excludedPoll.map((a) => `0x${a.toString(16)}`).join(" ")})`);
  if (base.r.stopError || test.r.stopError || base.r.frames < args.frames || test.r.frames < args.frames) {
    console.log(`  run coverage: baseline ${base.r.frames}/${args.frames} (${base.r.stop}); test ${test.r.frames}/${args.frames} (${test.r.stop})`);
  }

  // Per-frame diff EXCLUDING the dead Z80 stack scratch: a direct idiomatic call doesn't
  // push/pop the return address a translated call does, so [stackLo, stackHi) legitimately
  // differs — the GAME-STATE RAM is what must match (docs: exclude the dead stack, keep the
  // RAM diff). Everything else matches: same engine, same NMI timing, same RNG.
  const [sLo, sHi] = cfg.stateExclude?.stack || [0, 0];
  const probe = new Machine(rom);
  const BPF = base.frames[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = probe.stateOffsetToAddr(o); if (!(a >= sLo && a < sHi)) keep.push(o); }
  const n = Math.min(base.frames.length, test.frames.length);
  let firstDiff = -1, diffCells = [];
  outer:
  for (let i = 0; i < n; i++) {
    const a = base.frames[i], b = test.frames[i];
    for (const o of keep) {
      if (a[o] !== b[o]) {
        firstDiff = i;
        for (const o2 of keep) if (a[o2] !== b[o2] && diffCells.length < 12) diffCells.push(`0x${probe.stateOffsetToAddr(o2).toString(16)}`);
        break outer;
      }
    }
  }

  const ran = [...counts.values()].filter((c) => c > 0).length;
  const never = [...counts.entries()].filter(([, c]) => c === 0).map(([a]) => `0x${a.toString(16)}`);
  console.log(`  dispatched: ${ran}/${nWired} wired routines actually ran in this scenario`);
  if (never.length) console.log(`  never ran (swap vacuous for these here): ${never.length} — ${never.slice(0, 12).join(" ")}${never.length > 12 ? " …" : ""}`);

  if (firstDiff < 0 && base.frames.length === test.frames.length) {
    console.log(`  TRANSPARENT — identical for all ${n} frames. The wired swap changed nothing.`);
    process.exit(0);
  }
  console.log(`  DIVERGED at frame ${firstDiff} (or length ${base.frames.length} vs ${test.frames.length}); cells: ${diffCells.join(" ")}`);
  console.log("  A wired idiomatic routine is NOT a transparent swap in the assembled game — bisect with --routines.");
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(2); });
