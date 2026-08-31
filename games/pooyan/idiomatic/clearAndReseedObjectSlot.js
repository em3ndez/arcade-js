// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { clampActorYAndAdvanceRenderPhase } from "./clampActorYAndAdvanceRenderPhase.js";
import { HUD_INTEGRITY_STRIP_A, COLORRAM_CHECKSUM_SENTINEL } from "./names.js";
/**
 * clearAndReseedObjectSlot — wipe one actor-record slot, then (for a spawn-worthy slot)
 * re-seed it behind a hidden colour-RAM integrity tripwire.
 *
 * WHAT IT IS
 *   An actor-slot (re)initialiser. Actor records live in the stride-0x18 arena based at
 *   ACTOR_TABLE (0x8a80); the `record` argument points at the one slot being recycled. The
 *   routine unconditionally blanks the slot's leading state bytes, decides from the slot's
 *   spawn index whether it is due to (re)appear, and — only when it is — writes fresh seed
 *   values into it.
 *
 * ROLE IN THE MACHINE
 *   Folded into the reseed is one of Pooyan's anti-tamper tripwires: a checksum over ten
 *   fixed colour-RAM cells that only an unmodified board can satisfy. On an intact ROM the
 *   check always passes and the slot is seeded normally; a modified image trips one of two
 *   failure arms — a hard crash, or a diversion into the tamper handler — so ordinary play
 *   never sees them fire. This is the same defensive style used across the ROM: the accept
 *   values are tuned to the shipped image, and every failure path is a tripwire, not a
 *   feature of normal play.
 *
 * ROM 0x77c8-0x780e.
 * Grounding: [seen]
 *
 * LIVE-OUT: none (memory only) — the slot at `record` is left either fully cleared (spawn
 *   index below 5) or cleared-then-seeded (+1=1, +2=3, +0x11=0x80). No register result; the
 *   caller reads the slot back through its own record pointer.
 */

const CHECK_CELLS = 10; //   colour-RAM cells summed by the integrity walk
const ROW_STRIDE = 0x20; //  one tile row (the walk steps UP one row per cell)
const CHECKSUM_BIAS = 0x83; // added to the running sum before the sentinel compare

export function clearAndReseedObjectSlot(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Blank the slot's leading state bytes. The record's leading state/flag bytes (+0..+6) and
  // its display-command scratch (+0x16) are all zeroed, so a freshly recycled slot starts
  // wholly inert before any decision about respawning it is made.
  for (const off of [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x16]) mem8[record + off] = 0x00;
  // Spawn gate: field +0x13 is this slot's spawn index. Below 5 the slot is not yet due to
  // (re)appear, so it is left cleared and the routine returns; only indices >= 5 fall through
  // to the reseed below.
  if (mem8[record + 0x13] < 0x05) return; // spawn index below 5 -> slot stays cleared

  // Reseed the now-live slot with its fresh initial values: +1 and +2 take the record's seed
  // pair (1, 3), and +0x11 is armed to 0x80 — a per-record countdown that later fires this
  // slot's display command (COUNTDOWN_EXPIRE_DISPLAY_CMD) when it drains to zero.
  mem8[record + 0x01] = 0x01;
  mem8[record + 0x02] = 0x03;
  mem8[record + 0x11] = 0x80;

  // Anti-tamper tripwire, folded into the reseed. Walk ten colour-RAM cells UPWARD from
  // HUD_INTEGRITY_STRIP_A (0x82bc), the base of a fixed on-screen colour strip, stepping one
  // tile row (0x20 bytes) up per cell and summing the bytes. Two conditions must hold on an
  // intact board: (a) every cell equals the cell one row above it (a uniform colour column),
  // and (b) the biased running sum matches the expected sentinel total.
  let ptr = HUD_INTEGRITY_STRIP_A;
  let sum = 0;
  for (let i = 0; i < CHECK_CELLS; i++) {
    const cell = mem8[ptr];
    ptr = u16(ptr - ROW_STRIDE); // step up one row (0x20 bytes) to the neighbour cell above
    // (a) neighbour check: an unequal cell means the colour strip has been altered. On the
    // machine this branch aims the program counter into a ROM data table (0x7875) whose bytes
    // decode as rst-0x38 garbage and crash the CPU — a tamper trap, modelled here as a throw.
    if (cell !== mem8[ptr]) throw new Error("clearAndReseedObjectSlot: colour-RAM integrity mismatch (tamper trap)");
    sum = (sum + cell) & 0xff; // (b) accumulate the 8-bit running colour sum
  }
  // (b) final checksum: the sum biased by 0x83 must equal the sentinel byte at
  // COLORRAM_CHECKSUM_SENTINEL (0x780e) — a ROM 0xc9 (the `ret` opcode) reused as the expected
  // total. A mismatch means the colour strip summed wrong, so control diverts to the tamper
  // handler (clampActorYAndAdvanceRenderPhase) instead of returning cleanly from the reseed.
  if (((sum + CHECKSUM_BIAS) & 0xff) !== mem8[COLORRAM_CHECKSUM_SENTINEL]) return clampActorYAndAdvanceRenderPhase(m); // sum mismatch -> tamper handler
}
