// SPDX-License-Identifier: GPL-3.0-only
/**
 * convergence — run a game CYCLE-FREE (core/frame-stepped.js, or the generator idiomatic layer with
 * --idiomatic) and validate it against a MAME golden with the drift-tolerant "reconverge" rule
 * (docs/pixel-gate.md). Whole-game analogue of the per-routine memory-equivalence gate, driven by the
 * game's manifest (`convergence.pollPCs`, `entropyPin`) — no game code here. Dropping the T-state clock
 * trades byte-exact-per-frame for convergent: each frame is scored against its NEAREST golden frame, and
 * the run PASSES iff none diverges past the threshold (transient diffs that reconverge are fine).
 *
 * Usage:
 *   node tools/convergence.mjs --game thepit --golden <dir> [--mode pixel|state]
 *        [--pin] [--frame-stride N] [--px-threshold 5] [--search-window W] [--idiomatic]
 *   --idiomatic drives runIdiomaticGame (the generator layer); it runs FASTER (delay-collapse), so give
 *   it a golden of ≥2 attract loops (extensive `pixel_suite --seconds`) or its ahead-frames find no match.
 *   <dir> is a mame_golden.py output dir (frames.rgb+json / state.bin+json); ROM/gfx/proms are the game's
 *   uncommitted BYO images under games/<game>/rom/. --pin installs manifest.entropyPin (use ONLY with a
 *   matching MAME-side pin; omit for the pixel gate, which reconverges unpinned).
 *
 * Exit 0 = converged (PASS), 1 = diverged (FAIL), 2 = usage/IO error.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runCycleFree, runIdiomaticGame } from "../core/frame-stepped.js";
import { installEntropyPin } from "../core/entropy-pin.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);

function parseArgs(argv) {
  const a = { mode: "pixel", frameStride: 15, pxThreshold: 5, searchWindow: Infinity, pin: false, idiomatic: false, tape: null, tapeOrigin: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--game") a.game = argv[++i];
    else if (k === "--golden") a.golden = argv[++i];
    else if (k === "--mode") a.mode = argv[++i];
    else if (k === "--pin") a.pin = true;
    else if (k === "--frame-stride") a.frameStride = parseInt(argv[++i], 10);
    else if (k === "--px-threshold") a.pxThreshold = parseFloat(argv[++i]);
    else if (k === "--search-window") a.searchWindow = parseInt(argv[++i], 10);
    else if (k === "--idiomatic") a.idiomatic = true;
    else if (k === "--tape") a.tape = argv[++i];
    else if (k === "--tape-origin") a.tapeOrigin = parseInt(argv[++i], 10);
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  if (!a.game || !a.golden) { console.error("need --game and --golden"); process.exit(2); }
  return a;
}

function loadBin(p) {
  if (!existsSync(p)) { console.error(`missing golden file: ${p}`); process.exit(2); }
  return readFileSync(p);
}

// Render the JS side: the generator engine (--idiomatic) or the cycle-free oracle (default).
// The idiomatic runs FASTER, so the golden must cover its ahead game-time. Returns {frames,stop,stopError}.
function renderRun(machine, cfg, args, GC, capture) {
  // Apply the input tape at f + tapeOrigin, exactly as render.js's runGeneratorFrames does, so a
  // gameplay golden (coin/start/play) can be validated — not just an input-free attract boot.
  const drive = (m, f) => { m.applyInputs(f + args.tapeOrigin); m.applyPokes(f + args.tapeOrigin); };
  if (args.idiomatic) {
    // The idiomatic ISR bodies are pure JS (no push16/m.step), so no seated SP is needed -- the
    // transitional bootSp seat is retired now that fireNmi fires them directly (games/invaders step 3).
    return runIdiomaticGame(machine, {
      nmiReturnPC: cfg.idiomatic?.nmiReturnPC,
      maxFrames: GC,
      onFrame: (m, f) => { if (f !== 0) { drive(m, f); capture(m); } }, // f=0 is power-on, before the boot chain runs
    });
  }
  return runCycleFree(machine, { pollPCs: cfg.pollPCs, maxFrames: GC, onFrame: (m, f) => { drive(m, f); capture(m); } });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gameDir = join(REPO, "games", args.game);

  const manifest = (await import(join(gameDir, "manifest.js"))).default;
  const cfg = manifest.convergence;
  if (!cfg || !cfg.pollPCs) {
    console.error(`games/${args.game}/manifest.js has no convergence.pollPCs — add it (see The Pit).`);
    process.exit(2);
  }
  const { Machine, resolveAllIdiomatic } = await import(join(gameDir, "machine.js"));

  const romDir = join(gameDir, "rom");
  const rom = new Uint8Array(loadBin(join(romDir, "maincpu.bin")));
  const needGfx = args.mode === "pixel";
  // Some boards ship one gfx.bin (thepit); others split it (pooyan: tiles.bin + sprites.bin). Load
  // whichever the game has so pixel mode paints instead of throwing "renderFrame needs tiles/sprites".
  const hasSplit = existsSync(join(romDir, "tiles.bin")) && existsSync(join(romDir, "sprites.bin"));
  const gfx = needGfx && !hasSplit ? new Uint8Array(loadBin(join(romDir, "gfx.bin"))) : undefined;
  const tiles = needGfx && hasSplit ? new Uint8Array(loadBin(join(romDir, "tiles.bin"))) : undefined;
  const sprites = needGfx && hasSplit ? new Uint8Array(loadBin(join(romDir, "sprites.bin"))) : undefined;
  const proms = needGfx ? new Uint8Array(loadBin(join(romDir, "proms.bin"))) : undefined;

  // --idiomatic drives runIdiomaticGame, which resumes the idiomatic GENERATOR spine — so the machine
  // must carry the idiomatic override map (resolveAllIdiomatic), exactly as render.js --idiomatic wires
  // it. Without it, machine.call(bootAddr) runs the TRANSLATED boot (not a generator) and the run is
  // silently the oracle, not the idiomatic layer.
  if (args.idiomatic && !resolveAllIdiomatic) {
    console.error(`games/${args.game} has no resolveAllIdiomatic export — --idiomatic needs an idiomatic layer.`);
    process.exit(2);
  }
  const overrides = args.idiomatic ? await resolveAllIdiomatic() : undefined;
  const machine = await Machine.create(rom, { gfx, tiles, sprites, proms, overrides });
  if (args.pin) installEntropyPin(machine, manifest.entropyPin);
  // Drive gameplay from an input tape (JSON array of {port,bits,frame,dur}), same shape render.js uses.
  if (args.tape) {
    machine.inputTape = JSON.parse(readFileSync(args.tape, "utf8"));
    console.error(`[tape] ${machine.inputTape.length} entries, tape-origin ${args.tapeOrigin}`);
  }

  if (args.mode === "pixel") return pixelGate(machine, cfg, args);
  if (args.mode === "state") return stateGate(machine, cfg, args);
  console.error(`unknown --mode ${args.mode} (pixel|state)`); process.exit(2);
}

// ── pixel convergence ────────────────────────────────────────────────────────
function pixelGate(machine, cfg, args) {
  const meta = JSON.parse(loadBin(join(args.golden, "frames.json")).toString());
  const gbin = loadBin(join(args.golden, "frames.rgb"));
  const W = meta.width, H = meta.height, FSZ = W * H * 3, GC = meta.count;
  const gframe = (i) => gbin.subarray(i * FSZ, (i + 1) * FSZ);
  // stride-8 downsample keeps the full-search affordable while staying sensitive to a
  // real screen divergence (a whole sprite/row moving shows in the sampled grid).
  const S = 8, SAMPLES = Math.ceil(W / S) * Math.ceil(H / S);
  const diffPct = (a, b) => {
    let d = 0;
    for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
      const o = (y * W + x) * 3;
      if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2]) d++;
    }
    return (100 * d) / SAMPLES;
  };

  // capture my rendered frames (all of them; scoring samples every frameStride)
  const mine = [];
  const run = renderRun(machine, cfg, args, GC, (m) => mine.push(Buffer.from(m.renderFrame())));

  const bins = { "<1%": 0, "1-5%": 0, "5-10%": 0, ">10%": 0 };
  let worst = 0, worstFrame = -1, checked = 0;
  for (let i = 0; i < mine.length; i += args.frameStride) {
    // alignment-free: nearest golden frame over the whole golden (robust to the attract
    // loop repeating; a monotonic window mis-locks on repeated title screens).
    const lo = args.searchWindow === Infinity ? 0 : Math.max(0, i - args.searchWindow);
    const hi = args.searchWindow === Infinity ? GC : Math.min(GC, i + args.searchWindow);
    let mn = 101;
    for (let j = lo; j < hi; j++) { const d = diffPct(mine[i], gframe(j)); if (d < mn) mn = d; }
    checked++;
    if (mn < 1) bins["<1%"]++; else if (mn < 5) bins["1-5%"]++;
    else if (mn < 10) bins["5-10%"]++; else bins[">10%"]++;
    if (mn > worst) { worst = mn; worstFrame = i; }
  }
  const over = bins["5-10%"] + bins[">10%"];
  // A run that stopped short (boot gap, or the step-budget spin backstop) covered less than
  // the golden — a partial run must NEVER read as PASS (docs/integration-testing.md: no
  // silent caps). `run.frames` caps at maxFrames on a full run, so short = truncated.
  const complete = !run.stopError && run.frames >= GC;
  console.log(`convergence [pixel]: ${mine.length} JS frames vs ${GC} golden (${checked} scored, stride ${args.frameStride})`);
  console.log(`  per-frame nearest-diff: ${JSON.stringify(bins)}`);
  console.log(`  worst single frame: ${worst.toFixed(2)}% (JS frame ${worstFrame}); frames over ${args.pxThreshold}%: ${over}`);
  if (!complete) {
    console.log(`  INCOMPLETE: cycle-free run covered ${run.frames}/${GC} frames before stop=${run.stop}` +
      `${run.stopError ? ` (${run.stopError.name})` : ""} — partial coverage cannot PASS`);
  }
  const pass = complete && worst <= args.pxThreshold;
  console.log(pass
    ? "PASS — reconverges (no frame past threshold)"
    : `FAIL — ${!complete ? "run did not cover the full golden" : `${over} frame(s) diverge past ${args.pxThreshold}%`}`);
  process.exit(pass ? 0 : 1);
}

// ── deterministic-state convergence ──────────────────────────────────────────
function stateGate(machine, cfg, args) {
  const meta = JSON.parse(loadBin(join(args.golden, "state.json")).toString());
  const sbin = loadBin(join(args.golden, "state.bin"));
  const BPF = meta.bytes_per_frame, GC = meta.count;
  const gframe = (i) => sbin.subarray(i * BPF, (i + 1) * BPF);
  // offset -> RAM address, from the golden's own region table (game-agnostic)
  const regions = meta.regions.map((r) => ({ start: parseInt(r.start, 16), len: r.len }));
  const off2addr = (o) => { let x = o; for (const r of regions) { if (x < r.len) return r.start + x; x -= r.len; } return -1; };
  const excl = new Set(cfg.stateExclude?.cells || []);
  const [sLo, sHi] = cfg.stateExclude?.stack || [0, 0];
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = off2addr(o); if (!excl.has(a) && !(a >= sLo && a < sHi)) keep.push(o); }

  const mine = [];
  const run = renderRun(machine, cfg, args, GC, (m) => mine.push(Buffer.from(m.dumpState())));

  const diff = (a, b) => { let n = 0; for (const o of keep) if (a[o] !== b[o]) n++; return n; };
  const bins = { "0": 0, "1-4": 0, "5-16": 0, ">16": 0 };
  let worst = 0, checked = 0;
  for (let i = 0; i < mine.length; i += args.frameStride) {
    let mn = 1e9;
    for (let j = 0; j < GC; j++) { const d = diff(mine[i], gframe(j)); if (d < mn) mn = d; }
    checked++;
    if (mn === 0) bins["0"]++; else if (mn <= 4) bins["1-4"]++; else if (mn <= 16) bins["5-16"]++; else bins[">16"]++;
    if (mn > worst) worst = mn;
  }
  console.log(`convergence [state]: ${mine.length} JS frames vs ${GC} golden (${checked} scored, ${keep.length}/${BPF} bytes kept)`);
  if (run.frames < GC || run.stopError) {
    console.log(`  NOTE: cycle-free run covered ${run.frames}/${GC} frames before stop=${run.stop}` +
      `${run.stopError ? ` (${run.stopError.name})` : ""} — state coverage is partial`);
  }
  console.log(`  deterministic-state nearest-diff: ${JSON.stringify(bins)}   worst ${worst} bytes`);
  console.log("  (RNG-driven demo content is the entropy residual — validated by --mode pixel, not here)");
  // state is a diagnostic view, not a hard gate (the entropy residual lives in the diff);
  // exit reflects whether the deterministic core mostly matches (majority of frames <=16).
  const good = bins["0"] + bins["1-4"] + bins["5-16"];
  process.exit(good >= checked / 2 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
