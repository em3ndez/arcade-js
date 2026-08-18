// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagSpriteObjectFrogHit  —  ROM 0x2b58  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Dispatcher-A's frog hit-test: the fifth and final arm the machine runs on one moving sprite object
 *   each frame. A "sprite object" is one of Frogger's drifting hazard/rideable creatures — a 16-byte work-
 *   RAM record that the engine advances one step per frame and stages into a hardware sprite slot. This arm
 *   box-tests the object's on-screen cell against the frog and, when they overlap, flags the frog as caught.
 *
 * WHERE IT SITS
 *   Called once per active dispatcher-A object per frame by dispatchSpriteObjectArmsA (ROM 0x29b9), AFTER
 *   that dispatcher's spawn / animate / motion / place arms have already moved and drawn the object this
 *   frame — so the slot X this routine reads is the object's final position for the frame. It is a leaf
 *   (no onward calls). Its dispatcher-B twin is flagSpriteObjectFrogHitAhead (0x2ca8), which tests the
 *   single steerable ride-object; this arm tests the free-drifting two-tile creatures.
 *
 *   Two pointers arrive in registers:
 *     obj  = IX = the object's 16-byte record base (work RAM). Fields used: +4 row/category, +5 direction
 *                 /H-flip bit, +6 active-state byte. See mechanisms.md "Object records and hardware slots".
 *     slot = IY = the object's 4-byte hardware sprite slot [X, code, color, Y]; slot+0 is the on-screen X.
 *
 * LIVE-OUT
 *   Memory only, and only on a hit: it raises HOLD_FLAG (0x8004) = 1 and the global hit gate
 *   loc_842c (0x842c) = 1. It returns nothing and leaves no register the caller reads; on every miss it
 *   falls through one of the early `return`s and touches no memory at all. Raising loc_842c is load-
 *   bearing beyond marking the catch: dispatcher-A's motion arm (loc_29f9, 0x29f9) only steps its objects
 *   while that gate is 0, so setting it here freezes every dispatcher-A creature the instant the frog dies.
 */
import { FROG_Y, FROG_X, HOLD_FLAG, loc_842c } from "./names.js";

// The object's row/category byte (IX+4) is stored 2 short of the frog-row value it must match: the ROM
// adds 2 to it before comparing against FROG_Y (0x8047). Adding this bias aligns the two before the
// equality test that decides whether object and frog share a row.
const ROW_BIAS = 2;

// Horizontal-flip compensation. When the direction bit (IX+5) is set the hardware draws the object H-
// flipped, and its slot X (IY+0) then refers to the object's other edge; adding DIR_OFFSET (0x10 = 16px,
// one sprite-cell width) shifts the compared point so the same overlap window lands on the creature's body
// for either facing. (Grounded docs call this the "+16 / half-tile" direction bias.)
const DIR_OFFSET = 0x10;

// Width of the horizontal overlap window, in pixels (one sprite cell). The object counts as touching the
// frog when its X sits in the half-open band [frogX, frogX + 16).
const HIT_WINDOW = 16;

export function flagSpriteObjectFrogHit(m, obj = m.regs.ix, slot = m.regs.iy) {
  const { mem8 } = m;

  // ── Gate 1: is this object slot live? ─────────────────────────────────────────────────
  // The active/state byte (IX+6) is 0 while the object is idle (unspawned / retired). Every dispatcher-A
  // arm early-returns on an idle object, so a dead slot never collides.
  if (mem8[(obj + 0x06)] === 0) return;

  // ── Gate 2: is the object on the frog's row? ──────────────────────────────────────────
  // Compare the object's row attribute (IX+4) — biased up by ROW_BIAS to line up with FROG_Y's scale —
  // against the frog row FROG_Y (0x8047). A different row means no possible collision; done.
  if (((mem8[(obj + 0x04)] + ROW_BIAS) & 0xff) !== mem8[FROG_Y]) return;

  // ── The object's on-screen X, corrected for facing ────────────────────────────────────
  // slotX is the sprite's hardware X (slot+0 = IY+0). If the direction/H-flip bit (IX+5) is set, shift it
  // right by one sprite cell so the overlap test below lands on the creature's body regardless of facing.
  let slotX = mem8[(slot + 0x00)];
  if (mem8[(obj + 0x05)] !== 0) slotX = (slotX + DIR_OFFSET) & 0xff;

  // ── Horizontal overlap: is the object within the hit window ahead of the frog? ─────────
  // frogX is the frog's X (FROG_X 0x8044). The object hits only when it sits in the half-open band
  // [frogX, frogX + 16):
  //   (a) object is left of the frog          → slotX < frogX               : no overlap (the ROM's borrow)
  //   (b) object is a full window or more away → (slotX - frogX) & 0xff >= 16: too far right
  // The & 0xff mirrors the Z80's 8-bit subtract; guard (a) already rules out a borrow, so (b) is a plain
  // in-range test. Anything that survives both guards overlaps the frog.
  const frogX = mem8[FROG_X];
  if (slotX < frogX) return;
  if (((slotX - frogX) & 0xff) >= HIT_WINDOW) return;

  // ── Hit → mark the frog caught and freeze the objects ─────────────────────────────────
  // Raise HOLD_FLAG (0x8004): the shared hold/kill flag that halts frog input and hands the frog to the
  // death path. Raise the global hit gate loc_842c (0x842c): dispatcher-A's motion arm (0x29f9) runs only
  // while this is 0, so the caught frog's attackers stop dead this frame. Both are cleared later during the
  // frog-object reset (resetFrogObject, 0x09aa).
  mem8[HOLD_FLAG] = 1;
  mem8[loc_842c] = 1;
}
