// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { activateLaneActorSlot } from "./activateLaneActorSlot.js";
import {
  SLOT_SWEEP_LATCH,
  SCRIPT_DATA_PTR,
  SCRIPT_DELAY_TIMER,
  SCRIPT_ADVANCE_GUARD,
  STAGE_COUNTDOWN,
  ENEMY_SPAWN_TIMER,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
/**
 * spawnNextScriptedEnemy — the RELEASE stage of Pooyan's scripted lane-enemy machine.
 *
 * ROM 0x5334 (0x5334-0x5373). Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * Each board releases its lane enemies from a compact "spawn script": a run of bytes played out one at
 * a time as the stage clock drains. An ordinary script byte is a delay count — how many frames to wait
 * before releasing the next enemy — and the byte 0xff is the script terminator that ends the program.
 * A live cursor (SCRIPT_DATA_PTR, 0x8d71) walks that byte stream, and a countdown (SCRIPT_DELAY_TIMER,
 * 0x8d73) paces the gap between releases. This routine is the consumer at the end of that machine: once
 * per frame, when the sweep has been armed, it advances the delay, and on each expiry it steps the
 * cursor and brings one more lane enemy to life. It is the third of three cooperating passes — INSTALL
 * seeds the program, ARM opens the go-signal, and this is RELEASE.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Nothing happens here until the arming pass has raised the sweep latch (SLOT_SWEEP_LATCH, 0x8d6e),
 * so this routine is a no-op on most frames. When armed, it reads the current script byte through the
 * live cursor and forks:
 *   • Ordinary byte (a delay count): tick the pacing timer; while it is still running, wait. On the
 *     frame it expires, reseed the timer from the script byte, step the cursor to the next byte, and
 *     sweep the six-slot lane-enemy pool at ENEMY_ACTOR_TABLE (0x8ae0), activating exactly one free
 *     record. The one-spawn-per-release budget is spent the instant a slot is claimed, which stops the
 *     sweep early.
 *   • Terminator (0xff): the program has run out. Once the stage clock STAGE_COUNTDOWN (0x8901) has
 *     drained past the armed threshold SCRIPT_ADVANCE_GUARD (0x8d6d), tear the whole program down —
 *     clear the guard, the sweep latch, and the spawn-cadence timer — so the board can arm its next
 *     program.
 *
 * LIVE-OUT: memory only. On the release path it decrements/reseeds SCRIPT_DELAY_TIMER (0x8d73),
 * advances the cursor SCRIPT_DATA_PTR (0x8d71), and stamps one lane-enemy record live in the pool at
 * ENEMY_ACTOR_TABLE (0x8ae0). On the teardown path it zeroes SCRIPT_ADVANCE_GUARD (0x8d6d),
 * SLOT_SWEEP_LATCH (0x8d6e), and ENEMY_SPAWN_TIMER (0x8d07). Nothing is left in a CPU register.
 */

// Geometry of the lane-enemy actor pool at ENEMY_ACTOR_TABLE (0x8ae0): SWEEP_COUNT (6) fixed-size
// records, each RECORD_STRIDE (0x18) bytes apart. TERMINATOR (0xff) is the script's end-of-program
// marker — every other byte value is treated as a frame-delay count.
const RECORD_STRIDE = 0x18;
const SWEEP_COUNT = 0x06;
const TERMINATOR = 0xff;

export function spawnNextScriptedEnemy(m) {
  const { mem8 } = m;

  // Arming gate (ROM 0x5337-0x5338). The sweep runs only after the arming pass has written the free-
  // slot count into SLOT_SWEEP_LATCH (0x8d6e). A zero latch means the release is not armed this cycle,
  // so there is nothing to do.
  if (mem8[SLOT_SWEEP_LATCH] === 0) return; // not latched (ret z)

  // Read the current script byte (ROM 0x5339-0x533e). SCRIPT_DATA_PTR (0x8d71) is a 16-bit little-
  // endian cursor into the live spawn script; dereference it to fetch the byte the program is sitting
  // on right now.
  const ptr = mem8[SCRIPT_DATA_PTR] | (mem8[SCRIPT_DATA_PTR + 1] << 8); // 16-bit script pointer
  const scriptByte = mem8[ptr];

  // Fork on the script byte (ROM 0x533f). Any value other than the 0xff terminator is a frame-delay
  // count — the release path.
  if (scriptByte !== TERMINATOR) {
    // Pace the release (ROM 0x5358-0x5359). Tick SCRIPT_DELAY_TIMER (0x8d73) down one frame; while it
    // is still nonzero the gap between releases has not elapsed, so wait for a future frame.
    mem8[SCRIPT_DELAY_TIMER] = mem8[SCRIPT_DELAY_TIMER] - 1; // tick the delay (store truncates)
    if (mem8[SCRIPT_DELAY_TIMER] !== 0) return; // delay still running (ret nz)

    // Timer expired — this is a release frame (ROM 0x535a-0x535c). Reseed the pacing timer from the
    // current script byte so the same delay counts off again before the following release.
    mem8[SCRIPT_DELAY_TIMER] = scriptByte; // reseed the delay from the script byte
    // Advance the live cursor one byte forward (ROM 0x535d-0x5361), so the next expiry reads the next
    // script byte; SCRIPT_DATA_PTR (0x8d71) is stored back low byte then high byte.
    const next = u16(ptr + 1);
    mem8[SCRIPT_DATA_PTR] = next; // advance the pointer (low; store truncates)
    mem8[SCRIPT_DATA_PTR + 1] = next >> 8; //                     (high)

    // Sweep the lane-enemy pool (ROM 0x5365-0x5373). Walk the six stride-0x18 records at
    // ENEMY_ACTOR_TABLE (0x8ae0) and hand each to activateLaneActorSlot, which claims the record only
    // if it is free. Exactly one enemy is born per release: the first free slot wins and returns false,
    // which aborts the walk immediately (the one-spawn budget is spent). A slot that is already live
    // returns true, so the walk moves on to the next record.
    let rec = ENEMY_ACTOR_TABLE;
    for (let n = SWEEP_COUNT; n > 0; n--) {
      if (!activateLaneActorSlot(m, rec)) return; // activation -> abort the sweep (skip-return)
      rec = u16(rec + RECORD_STRIDE);
    }
    return;
  }

  // Terminator path (ROM 0x5341-0x5354): the script byte is 0xff, so the program has reached its end.
  // Gate the teardown on the stage clock (ROM 0x5344-0x5349): SCRIPT_ADVANCE_GUARD (0x8d6d) is the
  // threshold the stage countdown STAGE_COUNTDOWN (0x8901) must have drained below. While the clock is
  // still at or above the threshold the program stays armed, so return and wait.
  if (mem8[STAGE_COUNTDOWN] >= mem8[SCRIPT_ADVANCE_GUARD]) return; // threshold not passed (ret nc)
  // Threshold passed — tear the spawn program down (ROM 0x534b-0x5354). Clear the advance guard (the
  // "program in force" flag), the sweep latch (the go-signal), and the spawn-cadence countdown
  // ENEMY_SPAWN_TIMER (0x8d07), returning the machine to its idle state ready to arm the next program.
  mem8[SCRIPT_ADVANCE_GUARD] = 0;
  mem8[SLOT_SWEEP_LATCH] = 0;
  mem8[ENEMY_SPAWN_TIMER] = 0;
}
