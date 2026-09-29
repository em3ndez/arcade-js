#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * translated_live_probe -- does the LIVE idiomatic game execute any translated code?
 *
 * Runbook §5 done criterion (a): every reachable routine runs as JS in the live game; ZERO translated
 * routines. A probe that wraps only the routine map (m.call dispatch) cannot see translated code entered
 * any other way -- a direct ES import from idiomatic/, a call from machine.js (fireNmi, reset), a board
 * hook. This probe counts at the translated routine's OWN BODY, so the way it was entered is irrelevant.
 *
 * HOW. The game is loaded from a COPY of games/<g>/ (its top-level .js files, idiomatic/ and translated/
 * copied; data dirs such as rom/ linked; the rest of the repo linked). Copied, not linked: the loader
 * resolves a link to its real path, so a linked module would import the REAL, uninstrumented tree. Every
 * `export function NAME(` in translated/*.js (the generated _registry excluded) opens with one counter
 * statement and nothing else in the copy differs. The engine is the one web/worker.js ships: the machine
 * is built through web/machine-factory.js buildGameMachine with resolveAllIdiomatic() overrides and a
 * board Inputs, then run under runIdiomaticGame (vblank-NMI games) or runIdiomaticIrqGame (manifest
 * convergence.idiomatic.irq games), rendering each frame the way serviceIdiomaticFrame does. Inputs come
 * from a per-game coin/start/play tape (TAPES below) seeded from that game's standing whole-game test.
 *
 * ENTRY PATHS. The host stack is sampled on a routine's first SAMPLE_FIRST hits and every
 * SAMPLE_EVERY-th after. Walking outward from the hit, the contiguous run of translated/ frames is the
 * translated chain; its outermost frame is the ROOT (the translated routine live code entered) and the
 * first frame outside it is VIA (who entered it: machine.js call() = an m.call dispatch, an idiomatic/
 * module = a direct import, machine.js fireNmi/reset = the board). FROM is the nearest games/<g>/ frame
 * at or beyond VIA (the live caller). Counts are exact; entry paths are samples.
 *
 * Usage: node tools/translated_live_probe.mjs --game dkong [--frames 3600] [--json out.json] [--top 12]
 *        node tools/translated_live_probe.mjs --all [--frames N] [--json out.json] [--attract]
 * --attract drops the tape (boot + attract/demo only). Exit 0 only when every game ran clean with no
 * translated routine executed.
 */

import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const HOOK_FILE = "__translated_live_probe_hook.js";
export const SAMPLE_FIRST = 64;
export const SAMPLE_EVERY = 256;

// ── the instrumented tree ──────────────────────────────────────────────────────────────────────

/** Insert `stmt` as the first statement of every `export function[*] NAME(...) {` in `src`. */
export function instrumentSource(src, stmtFor) {
  const re = /^export function\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm;
  const names = [];
  let out = "";
  let last = 0;
  for (const mt of src.matchAll(re)) {
    let i = mt.index + mt[0].length;
    for (let depth = 1; depth > 0; i++) {
      if (i >= src.length) throw new Error(`probe: ${mt[1]}: unbalanced parameter list`);
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    const open = src.slice(i).search(/\S/);
    if (open < 0 || src[i + open] !== "{") throw new Error(`probe: ${mt[1]}: no body after the parameter list`);
    const at = i + open + 1;
    out += src.slice(last, at) + ` ${stmtFor(mt[1])}`;
    last = at;
    names.push(mt[1]);
  }
  return { src: out + src.slice(last), names };
}

const trees = [];
process.on("exit", () => { for (const t of trees) rmSync(t, { recursive: true, force: true }); });

/**
 * Build the instrumented copy for `game`. `edits` (tests only): { "<path under games/<g>>": (src) => src },
 * applied AFTER instrumentation -- a mutant control. Fails closed: an edit that changes nothing throws, and
 * a translated/ file with no instrumentable export throws.
 */
export function buildProbeTree(game, { edits = {}, instrument = true } = {}) {
  const gameDir = join(REPO, "games", game);
  statSync(join(gameDir, "machine.js"));
  // realpath: stack frames carry resolved paths (macOS tmpdir is a /var -> /private/var link)
  const root = realpathSync(mkdtempSync(join(tmpdir(), `tlp-${game}-`)));
  trees.push(root);
  for (const e of readdirSync(REPO)) if (e !== "games") symlinkSync(join(REPO, e), join(root, e));
  mkdirSync(join(root, "games"));
  for (const e of readdirSync(join(REPO, "games"))) {
    if (e !== game) symlinkSync(join(REPO, "games", e), join(root, "games", e));
  }
  const g = join(root, "games", game);
  mkdirSync(g);
  for (const e of readdirSync(gameDir)) {
    const src = join(gameDir, e);
    const isDir = statSync(src).isDirectory();
    if (e === "idiomatic" || e === "translated") {
      cpSync(src, join(g, e), { recursive: true, filter: (p) => !/\/idiomatic\/test(\/|$)/.test(p) });
    } else if (!isDir && /\.(m?js|json)$/.test(e)) {
      cpSync(src, join(g, e));
    } else {
      symlinkSync(src, join(g, e));
    }
  }
  const tdir = join(g, "translated");
  writeFileSync(join(tdir, HOOK_FILE), "// translated_live_probe: set per tree\nexport const hook = { hit: null };\n");
  const routines = [];
  if (instrument) {
    for (const f of readdirSync(tdir).sort()) {
      if (!f.endsWith(".js") || f === HOOK_FILE || f.startsWith("_registry")) continue;
      const path = join(tdir, f);
      const { src, names } = instrumentSource(readFileSync(path, "utf8"),
        (n) => `__tlpHook.hit(${JSON.stringify(n)});`);
      if (!names.length) throw new Error(`probe: translated/${f} exports no function to instrument`);
      writeFileSync(path, `${src}\nimport { hook as __tlpHook } from "./${HOOK_FILE}";\n`);
      routines.push(...names);
    }
  }
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(g, file);
    const before = readFileSync(path, "utf8");
    const after = edit(before);
    if (after === before) throw new Error(`probe: the edit of ${file} changed nothing -- a vacuous mutant`);
    writeFileSync(path, after);
  }
  return { root, game, gameDir: g, routines, hook: pathToFileURL(join(tdir, HOOK_FILE)) };
}

// ── the counter ────────────────────────────────────────────────────────────────────────────────

const FRAME_RE = /^\s*at (?:async )?(?:(.+?) \()?(?:file:\/\/)?(\/[^():]+):(\d+):\d+\)?$/;

export class Probe {
  constructor(tree) {
    this.tree = tree;
    this.frame = 0;
    this.hits = new Map(); // name -> { count, firstFrame, lastFrame, frames:Set?, entries: Map(key->n) }
    this.prefixes = [tree.root, REPO];
  }

  rel(file) {
    for (const p of this.prefixes) if (file.startsWith(p + "/")) return file.slice(p.length + 1);
    return file;
  }

  hit(name) {
    let r = this.hits.get(name);
    if (!r) {
      r = { count: 0, firstFrame: this.frame, lastFrame: this.frame, frameSet: new Set(), entries: new Map() };
      this.hits.set(name, r);
    }
    r.count++;
    r.lastFrame = this.frame;
    r.frameSet.add(this.frame);
    if (r.count <= SAMPLE_FIRST || r.count % SAMPLE_EVERY === 0) this.sample(r);
  }

  sample(r) {
    const lim = Error.stackTraceLimit;
    Error.stackTraceLimit = 5000;
    const stack = new Error().stack;
    Error.stackTraceLimit = lim;
    const frames = [];
    for (const line of stack.split("\n").slice(1)) {
      const mt = FRAME_RE.exec(line);
      if (mt) frames.push({ fn: (mt[1] || "<anon>").replace(/^Object\./, ""), file: this.rel(mt[2]) });
    }
    const tprefix = `games/${this.tree.game}/translated/`;
    const iprefix = `games/${this.tree.game}/idiomatic/`;
    const gprefix = `games/${this.tree.game}/`;
    const isT = (f) => f.file.startsWith(tprefix);
    // Plumbing a translated chain passes THROUGH: the machine.js dispatcher (m.call), core/, boards/.
    const isPlumbing = (f) =>
      (f.file === `${gprefix}machine.js` && /(^|\.)call$/.test(f.fn)) || f.file.startsWith("core/") ||
      f.file.startsWith("boards/");
    let i = 0;
    while (i < frames.length && !isT(frames[i])) i++; // skip the probe's own frames
    // ROOT: the outermost translated frame reached through translated code and plumbing only -- the
    // translated routine that LIVE code entered. VIA: the frame just outside it (how it was entered).
    let root = i;
    for (let j = i; j < frames.length && (isT(frames[j]) || isPlumbing(frames[j])); j++) if (isT(frames[j])) root = j;
    const via = frames[root + 1];
    // FROM: the nearest idiomatic/ frame beyond the root (the live caller); else the outermost game or
    // core frame (e.g. machine.js fireNmi under the engine, or the engine's own boot call).
    let from = null;
    for (let j = root + 1; j < frames.length; j++) if (frames[j].file.startsWith(iprefix)) { from = frames[j]; break; }
    if (!from) {
      for (let j = root + 1; j < frames.length; j++) {
        if (frames[j].file.startsWith(gprefix) || frames[j].file.startsWith("core/")) from = frames[j];
      }
    }
    const d = (f) => (f ? `${f.file.replace(gprefix, "")}:${f.fn}` : "<none>");
    const key = `${frames[root]?.fn} <- ${d(via)}${from && from !== via ? ` <- ${d(from)}` : ""}`;
    r.entries.set(key, (r.entries.get(key) || 0) + 1);
  }

  summary() {
    const routines = [...this.hits]
      .map(([name, r]) => ({
        name, count: r.count, frames: r.frameSet.size, firstFrame: r.firstFrame, lastFrame: r.lastFrame,
        entries: [...r.entries].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ path: k, samples: n })),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    // Root entry paths aggregated across routines (a nested routine repeats its root's path).
    const roots = new Map();
    for (const r of routines) for (const e of r.entries) roots.set(e.path, (roots.get(e.path) || 0) + e.samples);
    return {
      routinesExecuted: routines.length,
      totalHits: routines.reduce((s, r) => s + r.count, 0),
      routines,
      entryPaths: [...roots].sort((a, b) => b[1] - a[1]).map(([path, samples]) => ({ path, samples })),
    };
  }
}

// ── the live tapes (engine-frame ordinals, seeded from each game's standing whole-game test) ─────

function pressFn(actions, a) {
  return (name) => {
    const act = actions[name];
    if (!act) throw new Error(`tape: no manifest input action "${name}"`);
    a[act.port] = (a[act.port] || 0) | act.bit;
  };
}

// A digital tape: coin, start1, then a play pattern cycling `dirs` every `turn` frames and pulsing `fire`.
function digitalTape({ coin, start, hold = 8, play, dirs, turn = 40, fire, fireEvery = 24, fireFor = 5, source }) {
  return {
    source,
    apply(m, f, actions) {
      const a = {};
      const press = pressFn(actions, a);
      if (f >= coin && f < coin + hold) press("coin");
      if (f >= start && f < start + hold) press("start1");
      if (f >= play) {
        if (dirs?.length) press(dirs[Math.floor((f - play) / turn) % dirs.length]);
        if (fire && (f - play) % fireEvery < fireFor) press(fire);
      }
      m.io.inputAssert = a;
    },
  };
}

function jsonTape(game, file, kind, source) {
  const tape = JSON.parse(readFileSync(join(REPO, "games", game, "tapes", file), "utf8"));
  return {
    source,
    apply(m, f) {
      const bits = {};
      const entries = kind === "tempest" ? tape.inputs : tape;
      for (const t of entries) {
        if (!(f >= t.frame && (t.dur == null || f < t.frame + t.dur))) continue;
        if (t.track) { m.io.applyTrackball(t.track[0], t.track[1]); continue; }
        bits[t.port] = (bits[t.port] || 0) | t.bits;
      }
      m.io.inputAssert = bits;
      if (kind === "tempest") {
        for (const s of tape.spinner || []) {
          if (f >= s.frame && f < s.frame + s.dur) m.io.applyTrackball(0, s.delta & 0xff);
        }
      }
    },
  };
}

export const TAPES = {
  centiped: () => jsonTape("centiped", "coin_start_play.json", "centiped", "tapes/coin_start_play.json (test/tape.test.js)"),
  tempest: () => jsonTape("tempest", "coin_start_play.json", "tempest", "tapes/coin_start_play.json (test/tape.test.js)"),
  dkong: () => digitalTape({ coin: 200, start: 300, play: 420, dirs: ["right", "left", "up", "right", "down"],
    turn: 60, fire: "jump", fireEvery: 90, fireFor: 4, source: "coin@200 start@300 (test/idiomatic.test.js) + move/jump from 420" }),
  frogger: () => digitalTape({ coin: 150, start: 230, hold: 6, play: 340, dirs: ["up", "left", "up", "right"],
    turn: 30, source: "coin@150 start@230 up-hop@340 (test/vs-oracle-gameplay.test.js) + hop pattern from 340" }),
  galaxian: () => digitalTape({ coin: 182, start: 240, play: 360, dirs: ["right", "left"], turn: 40, fire: "fire",
    fireEvery: 24, fireFor: 6, source: "test/tape.test.js tapeInput (coin@182 start@240 fire/move@360)" }),
  invaders: () => digitalTape({ coin: 300, start: 360, hold: 6, play: 500, dirs: ["right", "left"], turn: 40,
    fire: "fire", fireFor: 4, source: "test/tape.test.js tapeInput (coin@300 start@360 fire/move@500)" }),
  pooyan: () => digitalTape({ coin: 300, start: 360, hold: 6, play: 420, dirs: ["up", "down"], turn: 60,
    fire: "fire", fireFor: 4, source: "test/tape.test.js tapeInput (coin@300 start@360 fire/up/down@420)" }),
  thepit: () => digitalTape({ coin: 402, start: 462, play: 480, dirs: ["down", "down", "left", "down", "right"],
    turn: 64, fire: "dig", fireEvery: 32, fireFor: 6, source: "test/idiomatic.test.js tapeInput (coin@402 start@462 down+dig@480) + left/right" }),
  timeplt: () => digitalTape({ coin: 101, start: 161, play: 221, dirs: ["up", "right", "down", "left"], turn: 97,
    fire: "fire", fireEvery: 23, fireFor: 7, source: "test/idiomatic.test.js inputAt (coin@100 start@160 play@220, f-1 offset)" }),
};

// In-play witness per game (the cell + value each game's standing whole-game test uses): proves the tape
// reached gameplay, so a zero is not a zero-over-attract-only.
export const PLAY_WITNESS = {
  centiped: { cell: "PLAYER_ACTIVE 0x0089", addr: 0x0089, inPlay: (v) => v === 1 },
  dkong: { cell: "GAME_STATE 0x6005", addr: 0x6005, inPlay: (v) => v === 3 },
  frogger: { cell: "PLAY_FLAG 0x83fe", addr: 0x83fe, inPlay: (v) => v !== 0 },
  galaxian: { cell: "GAME_STATE 0x4005", addr: 0x4005, inPlay: (v) => v === 3 },
  invaders: { cell: "GAME_IN_PROGRESS 0x20ef", addr: 0x20ef, inPlay: (v) => v !== 0 },
  pooyan: { cell: "MAIN_GAME_STATE 0x8805", addr: 0x8805, inPlay: (v) => v === 3 },
  tempest: { cell: "STATUS 0x0005 bit7", addr: 0x0005, inPlay: (v) => (v & 0x80) !== 0 },
  thepit: { cell: "GAME_STATE 0x8001", addr: 0x8001, inPlay: (v) => v === 1 },
  timeplt: { cell: "PLAY_ACTIVE 0xad30", addr: 0xad30, inPlay: (v) => v === 0xff },
};

// Attract only: no input at all (boot + the attract/demo cycle, long enough to loop it).
export const ATTRACT_ONLY = { source: "attract only (no input)", apply(m) { m.io.inputAssert = {}; } };

export const DONE_GAMES = ["centiped", "dkong", "frogger", "galaxian", "invaders", "pooyan", "tempest", "thepit"];
export const ALL_GAMES = [...DONE_GAMES, "timeplt"];

// ── the live run (web/worker.js's engine, headless) ─────────────────────────────────────────────

/**
 * Run `game` live under the probe. opts: { frames, edits, instrument, editOverrides(overrides), tape }.
 * Returns { game, engine, tape, frames, stop, stopError, summary, digest }.
 */
export async function probeGame(game, { frames = 3600, edits, instrument = true, editOverrides, tape } = {}) {
  const tree = buildProbeTree(game, { edits, instrument });
  const probe = new Probe(tree);
  const { hook } = await import(tree.hook.href);
  hook.hit = (name) => probe.hit(name);

  const machineUrl = pathToFileURL(join(tree.gameDir, "machine.js"));
  const manifest = (await import(pathToFileURL(join(tree.gameDir, "manifest.js")).href)).default;
  const machineMod = await import(machineUrl.href);
  const { Inputs } = await import(pathToFileURL(join(REPO, "boards", manifest.board, "io.js")).href);
  const { buildGameMachine } = await import(pathToFileURL(join(REPO, "web", "machine-factory.js")).href);
  const { runIdiomaticGame, runIdiomaticIrqGame } = await import(pathToFileURL(join(REPO, "core", "frame-stepped.js")).href);

  if (manifest.runtime !== "idiomatic") throw new Error(`${game}: manifest.runtime is not "idiomatic"`);
  const liveCfg = manifest.convergence?.idiomatic;
  const irqCfg = liveCfg?.irq;
  const overrides = await machineMod.resolveAllIdiomatic(machineUrl);
  if (editOverrides) editOverrides(overrides);
  const images = {};
  for (const n of Object.keys(manifest.rom.images)) {
    images[n] = new Uint8Array(readFileSync(join(REPO, "games", game, "rom", `${n}.bin`)));
  }
  const m = buildGameMachine(machineMod.Machine, new Inputs(), images, overrides);
  const t = tape ?? TAPES[game]();
  const actions = manifest.inputs.actions;
  const beam = typeof m.startBeamFrame === "function" && typeof m.finishBeamFrame === "function";
  // serviceIdiomaticFrame, minus the browser: inputs, render/publish, beam re-open.
  const w = PLAY_WITNESS[game];
  const play = { cell: w?.cell ?? null, frames: 0, first: -1 };
  const onFrame = (mm, f) => {
    probe.frame = f + 1; // code run after this yield belongs to the next frame
    if (w && w.inPlay(mm.mem.read8(w.addr))) { play.frames++; if (play.first < 0) play.first = f; }
    t.apply(mm, f, actions);
    if (f > 0 && (beam || typeof mm.renderFrame === "function")) beam ? mm.finishBeamFrame() : mm.renderFrame();
    if (beam) mm.startBeamFrame();
  };
  const engine = irqCfg ? "runIdiomaticIrqGame" : "runIdiomaticGame";
  const r = irqCfg
    ? runIdiomaticIrqGame(m, { bootAddr: irqCfg.bootAddr, irqVblank: irqCfg.irqVblank, maxFrames: frames, onFrame })
    : runIdiomaticGame(m, { nmiReturnPC: liveCfg.nmiReturnPC, maxFrames: frames, onFrame });
  hook.hit = null;
  let digest = 0;
  const st = typeof m.dumpState === "function" ? m.dumpState() : m.mem.dumpState();
  for (const b of st) digest = (Math.imul(digest, 31) + b) | 0;
  return {
    game, engine, tape: t.source, frames: r.frames, stop: r.stop, stopError: r.stopError ? String(r.stopError) : null,
    instrumented: tree.routines.length, play, summary: probe.summary(), digest,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────

function printResult(res, top) {
  const s = res.summary;
  console.log(`== ${res.game}  engine=${res.engine}  frames=${res.frames}  stop=${res.stop}` +
    `  instrumented=${res.instrumented}  translated-executed=${s.routinesExecuted}  hits=${s.totalHits}`);
  console.log(`   tape: ${res.tape}`);
  console.log(`   in-play witness ${res.play.cell}: ${res.play.frames} frames in play (first f${res.play.first})`);
  if (res.stopError) console.log(`   STOP ERROR: ${res.stopError}`);
  for (const r of s.routines.slice(0, top)) {
    console.log(`   ${r.name.padEnd(28)} count=${String(r.count).padStart(8)} frames=${r.frames} [${r.firstFrame}..${r.lastFrame}]`);
  }
  if (s.routines.length > top) console.log(`   ... ${s.routines.length - top} more`);
  console.log("   entry paths (root <- via <- from, sampled):");
  for (const e of s.entryPaths.slice(0, top)) console.log(`     ${String(e.samples).padStart(6)}  ${e.path}`);
  console.log(`   verdict (a): ${s.routinesExecuted === 0 ? "PASS -- no translated routine executed" : "FAIL -- translated code ran live"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const games = argv.includes("--all") ? ALL_GAMES : [opt("--game")].filter(Boolean);
  if (!games.length) { console.error("usage: translated_live_probe.mjs --game <g> | --all [--frames N] [--json out] [--top N]"); process.exit(2); }
  const frames = Number(opt("--frames", 3600));
  const tape = argv.includes("--attract") ? ATTRACT_ONLY : undefined;
  const top = Number(opt("--top", 12));
  const out = [];
  for (const g of games) {
    const res = await probeGame(g, { frames, tape });
    printResult(res, top);
    out.push(res);
  }
  const json = opt("--json");
  if (json) writeFileSync(json, JSON.stringify(out, null, 2));
  process.exit(out.every((r) => r.summary.routinesExecuted === 0 && !r.stopError) ? 0 : 1);
}
