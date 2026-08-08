// SPDX-License-Identifier: GPL-3.0-only
//
// Derive timeplt's poll set EMPIRICALLY:  node games/timeplt/tools/poll_detect.mjs [frames] [mode]
// modes -- main (the measurement) | mutate (plant a second poll) | inject (post an unissued command)
//
// The question: does any PC other than 0x0B93 wait on a cell only the vblank NMI writes? The
// manifest declared `pollPCs: [0x0b93]` from elimination, and the generator go-live turns the poll
// set into load-bearing structure -- every wait must become a `yield` -- so it needs measuring.
//
// HARNESS: the CYCLE-DRIVEN engine, which takes no poll set at all -- the NMI comes off the
// T-state clock, the way the ROM was built to run. Not runCycleFree: there the poll PC IS the trigger,
// so the NMI fires the instant PC reaches it and the spin under study never gets to spin.
//
// THE DETECTOR: an EPISODE is a maximal run of steps with no STATE write. A PC recurring inside
// one is a loop whose iterations changed nothing -- a wait; working loops write. Episodes are
// keyed by their PC SET, so one spin collapses to one row -- but a loop whose neighbours vary
// fragments across rows, which could dilute a real second poll below MIN_OCCUR.
//
// AN ABSENCE IS EVIDENCE ONLY FROM AN INSTRUMENT SHOWN ABLE TO FIND A PRESENCE: `mutate` plants a
// synthetic poll and must report it; `inject` posts a command the tape never issues, or refuses.
//
// ⚠ KNOWN BLIND SPOT, since "MEASURED" must not sound wider than it is: a wait that writes STATE
// each pass reads as work -- unseen, not absent. I/O writes are excluded so a watchdog kick is not
// mistaken for one.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GAME = dirname(dirname(fileURLToPath(import.meta.url)));

const { Machine, CYCLES_PER_FRAME } = await import(join(GAME, "machine.js"));
const manifest = (await import(join(GAME, "manifest.js"))).default;

const FRAMES = Number(process.argv[2] || 600);
const MODE = process.argv[3] || "main";
// A typo used to run `main` and exit 0, which reads as the mode you asked for having passed.
if (!["main", "mutate", "inject"].includes(MODE)) {
  console.error(`unknown mode "${MODE}" -- expected main | mutate | inject`);
  process.exit(2);
}

// A PC must recur this many times inside one write-free episode before it counts as a wait. Two
// is a loop; the floor is here so an ordinary `ret`-to-caller pair does not read as one.
const MIN_ITER = 3;

// An episode holding more distinct PCs than this is not a spin under any reading -- record that it
// was truncated rather than growing without bound. A DROPPER MUST PRINT ITS DROPS.
const MAX_EPISODE_PCS = 8192;

// A loop seen once that happened to end beside an NMI scores a perfect 1/1. A ratio needs a
// denominator before it is a ratio at all, so candidacy needs recurrence AND near-total release.
// RECURRENCE IS THE DISCRIMINATOR that separates the drain from the handlers' bounded checksum
// loops -- those are write-free and NMI-released too, they just do not come back.
const MIN_OCCUR = 5;
const RELEASE_FRAC = 0.9;
const isCandidate = (e) => e.ie && e.count >= MIN_OCCUR && e.byNmi / e.count >= RELEASE_FRAC;

const rom = new Uint8Array(readFileSync(join(GAME, "rom/maincpu.bin")));

// ── the tape ─────────────────────────────────────────────────────────────────
// Attract reaches most of the handler table but not what only a CREDITED, PLAYING machine runs,
// and unreached is untested rather than clean. Mirrors tapes/coin_play.lua -- same pinned frames
// and periods, its header carrying their reasons.
const COIN_FRAME = 300, COIN_HOLD = 8, START_FRAME = 360, START_HOLD = 8, PLAY_FROM = 420;
const TURN_PERIOD = 97, FIRE_PERIOD = 23, FIRE_HOLD = 7;
const { actions } = manifest.inputs;

function buildTape(frames) {
  const t = [
    { frame: COIN_FRAME, dur: COIN_HOLD, port: actions.coin.port, bits: actions.coin.bit },
    { frame: START_FRAME, dur: START_HOLD, port: actions.start1.port, bits: actions.start1.bit },
  ];
  const dirs = [actions.up, actions.right, actions.down, actions.left];
  for (let f = PLAY_FROM; f < frames; f++) {
    const d = dirs[Math.floor((f - PLAY_FROM) / TURN_PERIOD) % 4];
    t.push({ frame: f, dur: 1, port: d.port, bits: d.bit });
    if ((f - PLAY_FROM) % FIRE_PERIOD < FIRE_HOLD) {
      t.push({ frame: f, dur: 1, port: actions.fire.port, bits: actions.fire.bit });
    }
  }
  return t;
}

// ── the synthetic spin, for the mutation control ─────────────────────────────
// The translated layer executes JS, not ROM bytes, so patching a `jr` into the image would change
// NOTHING. The faithful analogue of a planted spin is an override that waits on a cell the NMI
// writes, stepping each iteration exactly as a translated wait loop does. SYNTH_PC is outside the
// 0x6000 ROM so it can never collide with a real address.
const SYNTH_PC = 0xf000;

// ⚠ BOUNDED TWO WAYS, neither of them tidiness. Each activation costs a frame -- that is what
// makes it a poll -- and waiting on the cell ALONE let one straddle many vblanks (the value can
// return to what it was between samples), backing the ring up until the game reached a routine the
// translated layer lacks and the run ABORTED. So: a few activations, each NMI-bounded to one
// frame, as the drain is. assertClean caught that; the crashed run had looked exactly like a pass.
const SYNTH_ACTIVATIONS = MIN_OCCUR + 3;

function plantSpin(overrides, host, inner, watchAddr) {
  let armed = SYNTH_ACTIVATIONS;
  overrides.set(host, (m, ...rest) => {
    const start = m.mem.read8(watchAddr);
    const startNmi = m.nmiCount;
    let guard = 0;
    while (armed > 0 && m.nmiCount === startNmi && m.mem.read8(watchAddr) === start && guard++ < 2_000_000) {
      m.step(SYNTH_PC, 12); // ld a,(nn) / cp / jr z -- one iteration of a wait
    }
    if (guard) armed -= 1;
    return inner(m, ...rest);
  });
}

// ── posting a command the tape never issues ──────────────────────────────────
// ⚠ POST THROUGH THE GAME'S OWN ROUTINE. Writing the pair by hand at the READ cursor looked
// equivalent and was not: the game posts at the WRITE cursor and ADVANCES it, so a hand-written
// pair left the cursors out of step, orphaning the next real command and skipping the
// drop-when-occupied rule.
const UNISSUED_CMD = 0x00;
const { postCommand } = await import(join(GAME, "idiomatic/postCommand.js"));

async function run({ host = 0, watchAddr = 0, injectAfterNmis = 0 } = {}) {
  const overrides = new Map();
  const m = await Machine.create(rom, { overrides });
  if (host) {
    const inner = m.routines.get(host);
    if (!inner) throw new Error(`no routine at ${hex(host)} to plant a spin in`);
    plantSpin(m.routines, host, inner, watchAddr);
  }
  m.maxCycles = FRAMES * CYCLES_PER_FRAME;
  m.inputTape = buildTape(FRAMES);

  const realStep = m.step.bind(m);
  const realWrite = m.mem.write8.bind(m.mem);
  const realRead = m.mem.read8.bind(m.mem);

  // Interrupts are OFF until the boot chain enables them, so every wait before that point spins on
  // the CPU, not on the NMI -- a true positive for the detector, a false one for the question.
  // Recorded per episode and reported, never silently filtered.
  let ieSeen = false;

  // ⇐ TWO CONTEXTS, AND THEY ARE NOT COMPARABLE. Time Pilot runs its whole game logic inside the
  // vblank NMI, so a loop in the handler ALWAYS closes on a handler write -- 100% "NMI-released"
  // by construction, which swamps the discriminator with false candidates. It also cannot be a
  // poll: the handler clears the enable bit, so the NMI cannot preempt itself. Only a FOREGROUND
  // loop can wait on the NMI, so only foreground arrivals are candidates. The in-handler loops are
  // still reported, as delays, rather than dropped.
  const episodes = new Map(); // pc-set signature -> { pcs, maxIter, count, ie, byNmi, truncated }
  const nmiEpisodes = new Map();
  let epFg = new Map();
  let epNmi = new Map();
  let epTrunc = false;
  let epIe = false;
  let closingWriteIsNmi = false;

  // Which cells does the NMI handler write? The mutation control needs a cell an outside agent
  // touches every frame; measure it here rather than guessing one.
  const nmiWrites = new Map();

  const record = (into, counts) => {
    let maxIter = 0;
    for (const n of counts.values()) if (n > maxIter) maxIter = n;
    if (maxIter < MIN_ITER) return;
    const pcs = [...counts.entries()].filter(([, n]) => n >= MIN_ITER).map(([pc]) => pc).sort((a, b) => a - b);
    const sig = pcs.map((p) => p.toString(16)).join(",");
    const e = into.get(sig) ?? { pcs, maxIter: 0, count: 0, ie: false, byNmi: 0, truncated: false };
    e.maxIter = Math.max(e.maxIter, maxIter);
    e.count += 1;
    // ⇐ THE DISCRIMINATOR, and it is only meaningful in the foreground. A WAIT is ended by an
    // OUTSIDE agent; a DELAY ends itself. The NMI's own `push16(pc)` is the first write of the
    // interrupt, so a foreground loop the NMI released closes on a write made at nmiDepth > 0.
    // A delay closes on its own next store; one the NMI happens to split scores a single such
    // close out of many, which is why this is a RATIO and not a flag.
    if (closingWriteIsNmi) e.byNmi += 1;
    e.ie ||= epIe;
    e.truncated ||= epTrunc;
    into.set(sig, e);
  };

  const closeEpisode = () => {
    record(episodes, epFg);
    record(nmiEpisodes, epNmi);
    epFg = new Map();
    epNmi = new Map();
    epTrunc = false;
    epIe = ieSeen;
  };

  // The stack lives at [0xafd6, 0xb000) (manifest convergence.stateExclude). EVERY NMI writes
  // there via push16, so counting it would name the stack as the cell the NMI "signals" through
  // and the mutation control would wait on a value that changes under its own feet.
  const [SP_LO] = manifest.convergence.stateExclude.stack;

  m.mem.write8 = function (addr, value, busOffset) {
    // WORK RAM ONLY, below the stack, and only where the VALUE MOVES. 0xC300 is the LS259 control
    // latch and 0xB0xx is sprite RAM; a wait on either tests the wrong thing. A synthetic poll
    // must watch a cell that genuinely carries a per-frame signal.
    if (m.nmiDepth && addr >= 0xa800 && addr < SP_LO && realRead(addr) !== (value & 0xff)) {
      nmiWrites.set(addr, (nmiWrites.get(addr) ?? 0) + 1);
    }
    // ⇐ ONLY A WRITE TO STATE ENDS AN EPISODE. RAM is 0xA000-0xBFFF. Above it sits the I/O region
    // at 0xC000-0xCFFF -- watchdog 0xC200, LS259 latch 0xC300 -- and above THAT writes are simply
    // dropped and counted, so neither range holds state. Counting the I/O ones
    // would make any wait that kicks the watchdog each pass look like work and hide it completely,
    // which is the one shape of poll this method is otherwise blind to. Below 0xA000 there is no
    // state either: memory.js THROWS on a write at or under 0x5FFF, and drops (and counts) one in
    // the unmapped float-high region above it.
    if (addr >= 0xa000 && addr < 0xc000) {
      closingWriteIsNmi = m.nmiDepth > 0;
      closeEpisode();
    }
    return realWrite(addr, value, busOffset);
  };

  // ⚠ ATTEMPTED IS NOT REACHED. An address with no routine raises NotImplemented and executes
  // nothing, so `reached` means only "dispatched somewhere that HAS a routine" -- not that the
  // body finished; assertClean is what earns the coverage line its standing. ⛔ The step hook must
  // NOT also add: the ring dispatch STEPS to its computed target before calling it, so an entry
  // address does appear there, and adding it back restores the false coverage this exists to stop.
  const reached = new Set();
  const missingRoutine = new Set();
  const realCall = m.call.bind(m);
  m.call = function (addr, ...args) {
    if (m.routines.has(addr)) reached.add(addr);
    else missingRoutine.add(addr);
    return realCall(addr, ...args);
  };

  let injected = false;
  m.step = function (nextAddr, cycles) {
    if (m.io.nmiMask) ieSeen = true;
    // postCommand owns the cursor and the drop rule; nothing here second-guesses it.
    if (injectAfterNmis && !injected && !m.nmiDepth && nextAddr === 0x0b93 && m.nmiCount >= injectAfterNmis) {
      postCommand(m, UNISSUED_CMD, 0x00);
      injected = true;
    }
    const bucket = m.nmiDepth ? epNmi : epFg;
    // Past the cap an ALREADY-PRESENT PC keeps counting: the cap bounds how many DISTINCT PCs are
    // held, and freezing repeats would stall the iteration count of the loop being measured.
    if (bucket.has(nextAddr)) bucket.set(nextAddr, bucket.get(nextAddr) + 1);
    else if (bucket.size < MAX_EPISODE_PCS) bucket.set(nextAddr, 1);
    else epTrunc = true;
    return realStep(nextAddr, cycles);
  };

  // Mark writes made from inside the NMI handler, so nmiWrites means what it says.
  const realFire = m.fireNmi.bind(m);
  m.nmiDepth = 0;
  m.fireNmi = function () {
    m.nmiDepth += 1;
    try { return realFire(); } finally { m.nmiDepth -= 1; }
  };

  let stop = "returned";
  try {
    m.reset();
  } catch (e) {
    stop = `${e.name}: ${e.message}`;
  }
  // A DEADLOCK NEVER ENDS WITH A WRITE, so the open episode is the one that matters most. Without
  // this flush the instrument is blind to exactly the finding it exists to produce. It closed on
  // the budget, not on a write, so it is neither NMI-released nor self-terminating.
  closingWriteIsNmi = false;
  closeEpisode();

  m.step = realStep;
  m.mem.write8 = realWrite;
  m.call = realCall;
  // A run that died mid-tape measured a PREFIX of the tape, so nothing it says about an absence is
  // load-bearing. The caller must gate on `clean`; see assertClean.
  const clean = stop.startsWith("FramesComplete");
  return { m, stop, clean, episodes, nmiEpisodes, nmiWrites, ieSeen, reached, missingRoutine, injected };
}

const hex = (n, w = 4) => `0x${n.toString(16).padStart(w, "0")}`;
// `hex` takes a PAD WIDTH second, so `arr.map(hex)` feeds it the array index. Bind the arity.
const hexOf = (n) => hex(n);

// ⇐ THIS MUST EXIT, NOT WARN. A run that threw mid-tape still fills every table, and those tables
// then read as a clean absence over code that never executed -- the failure mode is that the
// broken instrument's output looks like a FINDING, and like good news. Detect-print-proceed has
// checked nothing, so the process dies here rather than printing a verdict it cannot support.
function assertClean(r, label) {
  if (r.clean) return;
  console.error(`\n⛔ ${label}: THE RUN DID NOT COMPLETE — ${r.stop}`);
  console.error("   It measured a prefix of the tape, so no absence below would mean anything.");
  if (r.missingRoutine.size) {
    console.error(`   Dispatched with NO TRANSLATED ROUTINE: ${[...r.missingRoutine].map(hexOf).join(" ")}`);
  }
  process.exit(1);
}

function table3(rows, limit = 14) {
  if (!rows.length) { console.log("  (none)"); return; }
  console.log("  released-by-NMI  max-iter  seen  int?  PCs (one write-free loop body)");
  for (const e of rows.slice(0, limit)) {
    const trunc = e.truncated ? "  [PC set TRUNCATED]" : "";
    console.log(
      `  ${`${e.byNmi}/${e.count}`.padStart(9)}        ${String(e.maxIter).padStart(8)}` +
        `  ${String(e.count).padStart(4)}  ${e.ie ? "ON " : "off"}   ${e.pcs.map((p) => hex(p)).join(" ")}${trunc}`,
    );
  }
  if (rows.length > limit) console.log(`  … ${rows.length - limit} more rows not shown`);
}

function report(label, r) {
  // Rank by how NMI-RELEASED the loop is, then by size. Ranking by iteration count alone puts the
  // ROM's longest delay loop above the real poll, which is the mistake the design warns about.
  const byRelease = (a, b) => b.byNmi / b.count - a.byNmi / a.count || b.maxIter - a.maxIter;
  const rows = [...r.episodes.values()].sort(byRelease);
  console.log(`\n=== ${label}\n    frames ${FRAMES}, stop: ${r.stop}, NMI fired ${r.m.nmiCount}x`);

  const cands = rows.filter(isCandidate);
  console.log(`\n  FOREGROUND — the only context a poll can live in. POLL CANDIDATES (recurred >=${MIN_OCCUR}x, released by NMI >=${RELEASE_FRAC * 100}%):`);
  table3(cands);
  console.log("\n  foreground, NOT candidates — too few recurrences, or never NMI-released:");
  table3(rows.filter((e) => !isCandidate(e)), 8);
  console.log("\n  inside the NMI handler — cannot be polls (the handler masks its own interrupt), shown for completeness:");
  table3([...r.nmiEpisodes.values()].sort(byRelease), 6);
  return cands;
}

/** The 16-entry ring-command jump table at 0x0BBC, read from the IMAGE rather than transcribed. */
function handlerTable() {
  const out = [];
  for (let i = 0; i < 16; i++) out.push(rom[0x0bbc + i * 2] | (rom[0x0bbd + i * 2] << 8));
  return out;
}

// ── run ──────────────────────────────────────────────────────────────────────
const base = await run();
assertClean(base, "main");
const rows = report("POSITIVE CONTROL — no poll set given; can it rediscover 0x0B93?", base);

const found0b93 = rows.some((e) => e.pcs.includes(0x0b93));
console.log(`\n  0x0B93 rediscovered unaided: ${found0b93 ? "YES" : "NO"}`);
// ⇐ THE POSITIVE CONTROL MUST HALT TOO, for the same reason the abort does. A short budget stops
// before the interrupt is even unmasked, and the tool then prints "POLL CANDIDATES: (none)" and
// exits 0 -- an absence, from a run that never reached the code it is reporting about, and it
// reads like good news. Applying the doctrine only to the crash left this door open.
if (!found0b93) {
  console.error("\n⛔ THE POSITIVE CONTROL FAILED: the drain was not rediscovered.");
  console.error("   Nothing below is a measurement -- an instrument that cannot find the poll we");
  console.error("   KNOW is there says nothing about a second one. Too few frames is the usual cause.");
  process.exit(1);
}
console.log(`  interrupts were enabled during the run: ${base.ieSeen ? "yes" : "NO — nothing after 0x00A8 ran"}`);

// Coverage, printed whether or not it is flattering: a handler that never ran was never tested,
// so an absence over it is not a measurement.
const table = handlerTable();
const entries = [...new Set(table)];
const missed = entries.filter((a) => !base.reached.has(a));
const untranslated = entries.filter((a) => !base.m.routines.has(a));
console.log(`  ring handlers in the 0x0BBC table: ${entries.map(hexOf).join(" ")}`);
console.log(`  NOT REACHED on this tape (untested, not absent): ${missed.length ? missed.map(hexOf).join(" ") : "none — all ran"}`);
// Not a coverage gap this tool can close: with no routine there is nothing to run, at any input.
console.log(`  NO TRANSLATED ROUTINE — unreachable by ANY tape: ${untranslated.length ? untranslated.map(hexOf).join(" ") : "none"}`);

const hot = [...base.nmiWrites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(`  cells the NMI writes most (stack excluded): ${hot.map(([a, n]) => `${hex(a)}(${n})`).join(" ")}`);

if (MODE === "inject") {
  const target = table[UNISSUED_CMD];
  console.log(`\n=== COVERAGE — post command ${UNISSUED_CMD} (handler ${hexOf(target)}), which the tape never issues`);
  if (!base.m.routines.has(target)) {
    // Refuse rather than run. Dispatching it raises NotImplemented, and the run would then fill
    // every table from a truncated tape -- a clean-looking absence over code that never executed.
    console.log(`  ⛔ CANNOT BE EXERCISED: ${hexOf(target)} HAS NO TRANSLATED ROUTINE, so no tape`);
    console.log("     reaches it and dispatching it aborts the run. This is a TRANSLATION gap, not");
    console.log("     a tape gap, and the poll question over this handler stays OPEN until it is");
    console.log("     transcribed. Do not read the main-mode result as covering it.");
  } else {
    // Late enough to be in steady-state gameplay, but derived from the budget so a short run still
    // injects instead of silently reporting "no free ring cell".
    // In NMIs, which is what the hook compares -- NOT frames: the interrupt is masked through boot,
    // so NMIs lag frames by the whole power-on delay and a frame fraction lands near the budget.
    const inj = await run({ injectAfterNmis: Math.floor(base.m.nmiCount * 0.6) });
    assertClean(inj, "inject");
    const cands = report(`command ${UNISSUED_CMD} posted into the ring`, inj);
    console.log(`\n  command posted: ${inj.injected ? "yes" : "NO — no free ring cell was offered"}`);
    console.log(`  handler ${hexOf(target)} executed: ${inj.reached.has(target) ? "YES" : "NO"}`);
    const extra = cands.filter((e) => !e.pcs.includes(0x0b93));
    console.log(`  poll candidates other than the drain: ${extra.length ? extra.map((e) => e.pcs.map(hexOf).join("/")).join("  ") : "none"}`);
  }
}

if (MODE === "mutate") {
  // Plant it in a handler THAT ACTUALLY RAN. A spin inside an unreached handler would go
  // undetected for the same reason the handler is untested, and the control would prove nothing
  // while looking like it failed.
  const host = [...new Set(table)].find((a) => base.reached.has(a) && base.m.routines.has(a));
  const watchAddr = hot.length ? hot[0][0] : 0;
  if (!host || !watchAddr) {
    console.log("\n  MUTATION CONTROL CANNOT RUN — no reached handler, or no NMI-signalled cell.");
  } else {
    console.log(`\n  MUTATION CONTROL — planting a wait on ${hex(watchAddr)} inside handler ${hex(host)}`);
    const mut = await run({ host, watchAddr });
    assertClean(mut, "mutate");
    const mrows = report("MUTATION CONTROL — a synthetic poll was planted; is it found?", mut);
    const synth = mrows.find((e) => e.pcs.includes(SYNTH_PC));
    // Same door as the positive control: a mutation control that FAILS has shown the instrument
    // cannot find a planted poll, which makes every absence it reports worthless. It must halt.
    if (!synth) {
      console.error(`\n⛔ THE MUTATION CONTROL FAILED: the planted spin at ${hex(SYNTH_PC)} was NOT found.`);
      console.error("   The detector cannot see a poll it was handed, so it can say nothing about one it missed.");
      process.exit(1);
    }
    console.log(`\n  planted spin at ${hex(SYNTH_PC)} detected: YES — released by NMI ${synth.byNmi}/${synth.count}`);
  }
}
