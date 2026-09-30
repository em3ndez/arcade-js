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
 * statement and nothing else in the copy differs. Everything else in the tree is a link, and a module
 * reached through one resolves to its REAL path -- so a module resolve hook reports every real
 * games/<g>/translated/ module the run loads (summary.uncounted, with the importer): uncountable, so a
 * failure. The engine is the one web/worker.js ships: the machine
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
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { createHook } from "node:async_hooks";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const HOOK_FILE = "__translated_live_probe_hook.js";
const DRAIN_TURNS = 8; // event-loop turns after the run (each: one setImmediate, one setTimeout 0)
const REGISTRY_FILE = "_registry.generated.js"; // the generated address->routine map: imports, no bodies
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

/**
 * The byte offsets of every `export` keyword in CODE -- comments, string and template literals skipped,
 * member accesses (`x.export`) and longer identifiers (`exported`) excluded. Deliberately small: the
 * translated/ files are generated straight-line JS with no regex literals. Regex literals are NOT parsed:
 * one holding a quote could mis-open a string and hide a MID-LINE export from this scan. A line-LEADING
 * export cannot hide that way -- assertOnlyExportFunctions checks raw lines for those -- but a mid-line
 * export after such a regex literal is the one form neither check sees.
 */
export function exportTokens(src) {
  return codeWords(src, new Set(["export"]));
}

/** The byte offsets of each word in `words` used as a bare identifier in CODE (same scan as exportTokens). */
export function codeWords(src, words) {
  const at = [];
  let prev = ""; // the last non-blank CODE character (comments excluded): "." marks a member access
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      i++;
      prev = c;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      if (words.has(src.slice(i, j)) && prev !== ".") at.push(i);
      prev = src[j - 1];
      i = j;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return at;
}

/**
 * Fail closed on a translated/ file this probe cannot fully instrument: every `export` in code must be a
 * line-leading `export function[*] NAME(` -- the one form instrumentSource opens. `export const f = (m) =>`,
 * `export async function`, `export { f }`, `export default`, an indented or mid-line export: each is a
 * routine that could run live uncounted, so each throws. So does any use of the global object
 * (globalThis/window/self/global) or eval/Function. WHAT THIS DOES NOT SEE: a non-exported function handed
 * out at module top level some other way -- pushed into an object imported from another module, say -- and
 * then called without any export running. The probe counts exported entry points, not every function body.
 */
export function assertOnlyExportFunctions(src, file, names) {
  const raw = /^[ \t]+export\b.*|^export\b(?!\s+function\b).*/m.exec(src);
  if (raw) {
    throw new Error(`probe: ${file}: an export the probe cannot instrument (only a line-leading ` +
      `\`export function NAME(\` is counted): ${raw[0].trim()}`);
  }
  const tokens = exportTokens(src);
  for (const i of tokens) {
    const lineStart = src.lastIndexOf("\n", i - 1) + 1;
    if (i !== lineStart || !/^export function\*?\s*[A-Za-z_$][\w$]*\s*\(/.test(src.slice(i))) {
      const line = src.slice(lineStart, (src.indexOf("\n", i) + 1 || src.length + 1) - 1).trim();
      throw new Error(`probe: ${file}: an export the probe cannot instrument (only a line-leading ` +
        `\`export function NAME(\` is counted): ${line}`);
    }
  }
  if (tokens.length !== names.length) {
    throw new Error(`probe: ${file}: ${tokens.length} export(s) in code but ${names.length} instrumented`);
  }
  // A non-exported function is not instrumented. It can only run uncounted if something outside the file
  // gets a reference to it without calling an export first -- the global object is the channel a module's
  // top level could use, so any global-object or code-from-string name in code throws.
  for (const i of codeWords(src, GLOBAL_CHANNELS)) {
    const line = src.slice(src.lastIndexOf("\n", i - 1) + 1, (src.indexOf("\n", i) + 1 || src.length + 1) - 1).trim();
    throw new Error(`probe: ${file}: a global-object reference the probe cannot follow: ${line}`);
  }
}
const GLOBAL_CHANNELS = new Set(["globalThis", "window", "self", "global", "eval", "Function"]);

/**
 * The registry is skipped by NAME, so hold it to what the generator writes: comments, `import { a, b }
 * from "./x.js";`, `export const NAME = [` or `= new Map([`, `[0xADDR, name],` rows and the closers. Any
 * other line (a function body, an arrow, a call) throws -- code there would run uncounted.
 */
export function assertRegistryTableOnly(src) {
  const id = "[A-Za-z_$][\\w$]*";
  const ok = new RegExp(`^(\\s*(//.*)?|import \\{ ${id}(, ${id})* \\} from "\\./[\\w$]+\\.js";|` +
    `export const ${id} = (\\[|new Map\\(\\[)|  \\[0x[0-9a-fA-F]+, ${id}\\],|\\];|\\]\\);)$`);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (!ok.test(line)) throw new Error(`probe: translated/${REGISTRY_FILE}:${i + 1}: not a table line: ${line.trim()}`);
  });
}

// ── uncounted translated modules ─────────────────────────────────────────────────────────────────
//
// Only games/<g>/idiomatic|translated and top-level .js are COPIES; everything else in the tree is a link,
// and Node resolves a linked module to its REAL path -- so a module reached through a link (games/<g>/audio/,
// core/, boards/, web/, another game) that imports ../translated/X.js loads the real, UNINSTRUMENTED X. A
// resolve hook records every resolution to a real games/*/translated/ file outside a probe tree: loading one
// is a failure (its execution cannot be counted), attributed to the importer.
const GAMES_REAL = join(REPO, "games") + "/";
//
// And the static module graph is fully linked before frame 0, so ANY translated/ resolution -- in-tree copy
// or real -- once the live run has started is a DEFERRED load (a dynamic import(), a callback that pulls one
// in): recorded in `late`, also a failure.
let activeRun = null; // { uncounted, late, live } for the running probe; outside any probe -> strayUncounted
export const strayUncounted = [];
let resolveHooked = false;
function hookResolve() {
  if (resolveHooked) return;
  resolveHooked = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const r = nextResolve(specifier, context);
      if (r.url?.startsWith("file:")) {
        let p = fileURLToPath(r.url);
        try { p = realpathSync(p); } catch { /* unresolvable: leave as is, the load will fail loudly */ }
        const base = [...trees, REPO].find((t) => p.startsWith(t + "/"));
        const file = base ? p.slice(base.length + 1) : p;
        if (base && /^games\/[^/]+\/translated\//.test(file) && !file.endsWith(`/${HOOK_FILE}`)) {
          let from = context.parentURL ?? "<entry>";
          if (from.startsWith("file:")) from = fileURLToPath(from);
          for (const t of [...trees, REPO]) if (from.startsWith(t + "/")) { from = from.slice(t.length + 1); break; }
          const rec = { file, importer: from, copy: base !== REPO };
          if (base === REPO) (activeRun?.uncounted ?? strayUncounted).push(rec);
          if (activeRun?.live) activeRun.late.push(rec);
        }
      }
      return r;
    },
  });
}

// Temp trees are removed on exit and on SIGINT/SIGTERM (a killed run must not strand a repo-sized copy).
const trees = [];
function removeTrees() { for (const t of trees.splice(0)) rmSync(t, { recursive: true, force: true }); }
process.on("exit", removeTrees);
let signalsHooked = false;
function hookSignals() {
  if (signalsHooked) return;
  signalsHooked = true;
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, () => {
      removeTrees();
      process.kill(process.pid, sig); // listener gone (once): the default action now terminates
    });
  }
}

/**
 * Build the instrumented copy for `game`. `edits` (tests only): { "<path under games/<g>>": (src) => src },
 * applied AFTER instrumentation -- a mutant control. Fails closed: an edit that changes nothing throws, an
 * edit whose real path is outside the temp tree throws, a translated/ file with no instrumentable export or
 * with any export form but a line-leading `export function` throws, and a translated/ subdirectory (but
 * test/) or .mjs/.cjs module (code this probe does not open) throws.
 */
export function buildProbeTree(game, { edits = {}, instrument = true } = {}) {
  const gameDir = join(REPO, "games", game);
  statSync(join(gameDir, "machine.js"));
  hookSignals();
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
      if (f === "test") continue; // translated/test/: the translated layer's own tests, never imported live
      if (/\.[mc]js$/.test(f) || statSync(join(tdir, f)).isDirectory()) {
        throw new Error(`probe: translated/${f} is code the probe does not instrument`);
      }
      if (f === REGISTRY_FILE) { assertRegistryTableOnly(readFileSync(join(tdir, f), "utf8")); continue; }
      if (!f.endsWith(".js") || f === HOOK_FILE) continue;
      const path = join(tdir, f);
      const orig = readFileSync(path, "utf8");
      const { src, names } = instrumentSource(orig, (n) => `__tlpHook.hit(${JSON.stringify(n)});`);
      if (!names.length) throw new Error(`probe: translated/${f} exports no function to instrument`);
      assertOnlyExportFunctions(orig, `translated/${f}`, names);
      writeFileSync(path, `${src}\nimport { hook as __tlpHook } from "./${HOOK_FILE}";\n`);
      routines.push(...names);
    }
  }
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(g, file);
    // A link inside the tree (rom/, tapes/, the rest of the repo) resolves to the REAL repo: refuse any
    // edit whose real path is not inside this temp tree, so a mutant can never write the working copy.
    const real = realpathSync(path);
    if (!real.startsWith(root + "/")) throw new Error(`probe: the edit of ${file} resolves outside the temp tree (${real})`);
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

// The games with a committed DONE.md -- read from disk, so a newly DONE game joins --all (and the standing
// test tools/test/translated-live-all-done.test.js) with no list to update.
export const DONE_GAMES = readdirSync(join(REPO, "games"))
  .filter((g) => existsSync(join(REPO, "games", g, "DONE.md"))).sort();
export const ALL_GAMES = [...new Set([...DONE_GAMES, ...Object.keys(TAPES)])].sort();

// ── the live run (web/worker.js's engine, headless) ─────────────────────────────────────────────

/**
 * Run `game` live under the probe. opts: { frames, edits, instrument, editOverrides(overrides), tape }.
 * Returns { game, engine, tape, frames, stop, stopError, summary (incl. uncounted: real translated/ modules
 * resolved outside the tree, with importer), digest }.
 */
export async function probeGame(game, { frames = 3600, edits, instrument = true, editOverrides, tape } = {}) {
  hookResolve();
  const tree = buildProbeTree(game, { edits, instrument });
  const probe = new Probe(tree);
  hookAsync();
  const run = {
    uncounted: [], late: [], live: false, draining: false, tainted: new Set(), async: new Map(),
  };
  activeRun = run;
  try {
    return await runProbe(game, tree, probe, run, { frames, editOverrides, tape });
  } finally {
    activeRun = null;
  }
}

// Async resources. The shipped engine (web/worker.js) runs a session SYNCHRONOUSLY -- a while-loop and
// Atomics.wait, no await -- so the live game has no business creating any async resource: a timer (even
// one it clears), an immediate, a Worker or MessagePort, a nextTick, an fs or socket request -- each is
// code the probe might not see run (a Worker's thread has no counter at all), so each FAILS ON CREATION.
// A resource is the live game's if it was created during the synchronous run, or was triggered -- at any
// depth, through the drain -- by one that was (a setTimeout chain, a .then's callback). Promises fail too:
// measured, no DONE game's live run creates one (tape or attract), so none is allowed. The probe's own
// drain timers are created outside that lineage and so never count.
let asyncHooked = false;
function hookAsync() {
  if (asyncHooked) return;
  asyncHooked = true;
  createHook({
    init(id, type, triggerId) {
      const run = activeRun;
      if (!run || !(run.live && !run.draining ? true : run.tainted.has(triggerId))) return;
      run.tainted.add(id);
      run.async.set(type, (run.async.get(type) || 0) + 1);
    },
  }).enable();
}

async function runProbe(game, tree, probe, run, { frames, editOverrides, tape }) {
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
  run.live = true; // the static graph is linked: any translated/ resolution from here on is deferred
  const r = irqCfg
    ? runIdiomaticIrqGame(m, { bootAddr: irqCfg.bootAddr, irqVblank: irqCfg.irqVblank, maxFrames: frames, onFrame })
    : runIdiomaticGame(m, { nmiReturnPC: liveCfg.nmiReturnPC, maxFrames: frames, onFrame });
  // The run is synchronous, but code it queued (a .then, a microtask, setTimeout/setImmediate, a pending
  // import()) runs only when the event loop turns. Turn it until it is quiet, with the hook still counting,
  // so deferred translated execution lands in the summary; any async resource the run (or its
  // descendants, during the drain) created is reported -- fail closed on work it cannot watch.
  run.draining = true;
  for (let i = 0; i < DRAIN_TURNS; i++) {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 0));
  }
  const deferred = [...run.async].map(([k, n]) => `${n} ${k} async resource(s) created by the live run`);
  let digest = 0;
  const st = typeof m.dumpState === "function" ? m.dumpState() : m.mem.dumpState();
  for (const b of st) digest = (Math.imul(digest, 31) + b) | 0;
  return {
    game, engine, tape: t.source, frames: r.frames, stop: r.stop, stopError: r.stopError ? String(r.stopError) : null,
    instrumented: tree.routines.length, play,
    summary: { ...probe.summary(), uncounted: run.uncounted, late: run.late, deferred }, digest,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────

/** No translated routine counted, none loaded uninstrumented or late, and no deferred work left pending. */
export function clean(res) {
  const s = res.summary;
  return s.routinesExecuted === 0 && !s.uncounted.length && !s.late.length && !s.deferred.length;
}

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
  for (const u of s.uncounted) console.log(`   UNCOUNTED translated module loaded: ${u.file} <- ${u.importer}`);
  for (const u of s.late) console.log(`   LATE translated resolution during the live run: ${u.file} <- ${u.importer}`);
  for (const d of s.deferred) console.log(`   DEFERRED: ${d}`);
  console.log(`   verdict (a): ${clean(res) ? "PASS -- no translated routine executed"
    : s.routinesExecuted ? "FAIL -- translated code ran live" : "FAIL -- translated code loaded or left deferred work (see above)"}`);
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
  process.exit(out.every((r) => clean(r) && !r.stopError) ? 0 : 1);
}
