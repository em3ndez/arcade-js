// SPDX-License-Identifier: GPL-3.0-only
/**
 * Cycle-free ("frame-stepped") engines — run a game with NO T-state clock by firing the vblank NMI
 * at the game's vblank yield rather than an absolute cycle count. Three, in order of generality:
 * runCycleFree (poll-PC, translated only), runWatchdogGame (watchdog read), runIdiomaticGame
 * (coroutine — the model for a new game). TEST seams; the shipped game stays cycle-driven.
 *
 * The price, choosing poll PCs, and the go-live traps: docs/idiomatic-generation.md; runbook in
 * docs/integration-testing.md, "Go-live". Validate with tools/convergence.mjs, never a byte diff.
 */

/** Unwinds out of the call tree when a run is done; boot + main loop never return. Not an error. */
class RunComplete extends Error {
  constructor(reason) {
    super(reason);
    this.name = "RunComplete";
  }
}

/**
 * Run `machine` cycle-free from reset, calling `onFrame` at frame 0 (power-on) and at each poll PC
 * reached with the NMI unmasked. Wraps `step()` in place — construct a fresh Machine per run.
 *
 * @param {object} machine  a constructed game Machine; mutated in place
 * @param {object} opts  { pollPCs: vblank-yield addresses, maxFrames, onFrame, stepBudget }
 * @returns {{frames:number, steps:number, stop:string, stopError:(Error|null)}}
 */
export function runCycleFree(machine, { pollPCs, maxFrames = Infinity, onFrame, stepBudget = 6e8 } = {}) {
  const poll = pollPCs instanceof Set ? pollPCs : new Set(pollPCs);
  if (poll.size === 0) throw new Error("runCycleFree needs at least one poll PC");

  // Neutralise the cycle scheduler; this engine fires the NMI on control flow only.
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realStep = machine.step.bind(machine);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only the poll does

  let steps = 0;
  let inNmi = false;
  let frame = 0;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on, before any instruction runs

  machine.step = function (nextAddr, cycles) {
    realStep(nextAddr, cycles);
    if (++steps > stepBudget) throw new RunComplete("step-budget (unpolled spin?)");
    // A poll PC reached with the NMI unmasked IS a frame boundary. `inNmi` blocks the handler
    // re-triggering: its final `m.ret` steps back to the poll PC it interrupted.
    if (!inNmi && poll.has(this.pc) && this.io.nmiMask) {
      frame += 1;
      if (onFrame) onFrame(this, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      // realStep just set a genuine next-instruction address, so fireNmi's pcKnown guard holds.
      this.pcKnown = true;
      inNmi = true;
      try {
        realFire();
      } finally {
        inNmi = false;
      }
    }
  };

  let stop = "reached maxFrames";
  let stopError = null;
  try {
    machine.reset(); // enters at PC 0x0000; never returns — unwinds via RunComplete/error
    stop = "returned";
  } catch (e) {
    if (e instanceof RunComplete) {
      stop = e.message;
    } else {
      // Boot gap / unmapped access: frames already sampled stay valid, so surface why we stopped.
      stop = `${e.name}: ${e.message}`;
      stopError = e;
    }
  } finally {
    machine.step = realStep; // restore, so the instance stays inspectable
    machine.fireNmi = realFire;
  }

  return { frames: frame, steps, stop, stopError };
}

/**
 * runWatchdogGame — the whole game idiomatic, with no T-state clock. Idiomatic poll routines never
 * call `m.step`, so runCycleFree's seam is unavailable; this treats the once-per-frame WATCHDOG
 * KICK (a read of `watchdogPort`) as the vblank yield. Superseded by runIdiomaticGame — see below.
 *
 * @param {object} machine  a Machine with the FULL idiomatic override set wired (opts.overrides)
 * @param {object} opts  { watchdogPort, nmiReturnPC, maxFrames, onFrame, readBudget (per-frame) }
 * @returns {{frames:number, stop:string, stopError:(Error|null)}}
 */
export function runWatchdogGame(machine, { watchdogPort, nmiReturnPC, maxFrames = Infinity, onFrame, readBudget = 5e6 } = {}) {
  if (watchdogPort == null || nmiReturnPC == null) throw new Error("runWatchdogGame needs watchdogPort and nmiReturnPC");

  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realRead = machine.mem.read8.bind(machine.mem);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only the watchdog poll does

  let frame = 0;
  let readsSinceFrame = 0;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on

  machine.mem.read8 = function (addr) {
    const v = realRead(addr);
    // Per-frame spin backstop, reset each frame so a long healthy game never trips it.
    if (++readsSinceFrame > readBudget) throw new RunComplete("per-frame read budget (unpolled spin?)");
    if ((addr & 0xffff) === watchdogPort && machine.io.nmiMask) {
      // Deliberately NO "in NMI" guard: a watchdog read while a prior NMI is still on the JS
      // stack means that handler LONG-JUMPED into a new forever loop (the coin path). Those are
      // genuine frame boundaries and MUST fire, or the game freezes on the credit screen. Safe
      // because the handler never READS the watchdog. Cost: the abandoned handler stays on the
      // host stack, one frame per warm restart — the leak runIdiomaticGame removes.
      frame += 1;
      readsSinceFrame = 0;
      if (onFrame) onFrame(machine, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      machine.pcKnown = true;
      machine.pc = nmiReturnPC;
      realFire();
    }
    return v;
  };

  let stop = "returned";
  let stopError = null;
  try {
    machine.reset(); // enters idiomatic boot via the override at 0x0000; never returns
    stop = "returned";
  } catch (e) {
    if (e instanceof RunComplete) stop = e.message;
    else { stop = `${e.name}: ${e.message}`; stopError = e; }
  } finally {
    machine.mem.read8 = realRead;
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}

/**
 * runIdiomaticGame — the COROUTINE engine, and the model for a new game. The idiomatic
 * spine (boot, main loops, wait/hold loops) are GENERATORS that `yield` at each vblank wait. The
 * engine resumes the current one to its next yield, samples pre-NMI, then fires the NMI. A
 * coin/start/level/game-over transition is a WARM RESTART: the handler sets `machine.nextMain` to a
 * factory and the engine swaps it, letting the abandoned generator be collected — so the JS host
 * stack stays flat forever, removing runWatchdogGame's per-restart growth. The yield can sit
 * anywhere, so it ports with no per-game "find the forever loops" analysis.
 *
 * @param {object} machine  a Machine with idiomatic overrides wired (the spine must be generators)
 * @param {object} opts  { bootAddr, nmiReturnPC, maxFrames, onFrame }
 * @returns {{frames:number, stop:string, stopError:(Error|null)}}
 */
export function runIdiomaticGame(machine, { bootAddr = 0x0000, nmiReturnPC, maxFrames = Infinity, onFrame } = {}) {
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only a vblank yield does
  machine.booted = true;
  machine.nextMain = null;

  let frame = 0;
  let stop = "returned";
  let stopError = null;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on, before the boot generator runs

  // m.call of a generator returns the generator object; a spine tail delegates with `yield*`.
  let gen = machine.call(bootAddr);

  try {
    for (;;) {
      // Apply any pending warm restart BEFORE resuming, so an abandoned loop is never resumed.
      if (machine.nextMain) { gen = machine.nextMain(); machine.nextMain = null; }
      let r;
      try {
        r = gen.next(); // run the current main generator to its next vblank yield (or return)
      } catch (e) {
        // MID-FRAME warm restart: a service deep in the gameplay tree abandoned the frame and
        // handed us a successor. The aborted frame fires no NMI — its vblank never arrived.
        if (e === machine.RESTART && machine.nextMain) continue;
        throw e;
      }
      if (r.done) {
        if (machine.nextMain) continue; // it returned AND handed off (boot -> attract) -> swap
        stop = "returned";              // a main loop that returns with no hand-off is worth seeing
        break;
      }
      frame += 1;
      if (onFrame) onFrame(machine, frame); // sample PRE-NMI, at the vblank yield
      if (frame >= maxFrames) { stop = "reached maxFrames"; break; }
      // Fire the vblank NMI: push16(pc) + run the handler; it may set machine.nextMain (warm restart).
      machine.pcKnown = true;
      if (nmiReturnPC != null) machine.pc = nmiReturnPC;
      realFire();
    }
  } catch (e) {
    stop = `${e.name}: ${e.message}`;
    stopError = e;
  } finally {
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}
