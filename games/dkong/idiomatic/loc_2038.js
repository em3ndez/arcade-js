// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2038 — start one object record falling, and hand on to the shared sprite tail.  ROM 0x2038.
 *
 * The record is one slot of OBJ_ARRAY_67, walked by the ten-slot sweep at ROM 0x1F72 — which
 * returns immediately unless BOARD is 1 — and the sweep keeps the record's base in the index
 * register. Seven bytes of that record are written and nothing else: the initial vertical
 * velocity (+18:+19), the two coordinate fraction bytes (+4 and +6), the airborne frame counter
 * (+20), the sub-state counter (+14), and the sweep's per-record arm selector (+2). Control then
 * continues into the still-frozen shared sprite tail at ROM 0x21BA.
 *
 * WHAT THE ROLE LINE RESTS ON, and it is not this routine's own body — seven stores say nothing
 * about what the bytes mean. Each item below is a reading of a DIFFERENT body of code, and each
 * could have come out the other way:
 *   - The READER of four of these fields is ROM 0x239C (stepBallisticMotion), and its frozen
 *     oracle is unambiguous: +18:+19 is a big-endian 16-bit value SUBTRACTED from the vertical
 *     position every frame, +4 and +6 are the fraction halves of the 16.8 horizontal and vertical
 *     positions, and +20 is the counter whose growth widens the gravity slice added back. Had it
 *     read any of them as a timer or a table index, the role line would have died there.
 *   - MARIO SHARES THIS RECORD SHAPE, and his copy of it is grounded live against MAME. His base
 *     is 0x6200 and every offset lines up: MARIO_X_FRAC is +4, MARIO_Y_FRAC is +6,
 *     MARIO_AIR_VY_HI:MARIO_AIR_VY_LO is +18:+19, MARIO_AIR_FRAMES is +20. ram.js rates all four
 *     [seen] and records what they mean — the two fractions "cleared at jump init", the velocity
 *     pair the "INITIAL vertical velocity of the current jump/fall, constant across the whole
 *     arc", the counter "frames elapsed since Mario became airborne". So this seven-store block
 *     is a LAUNCH INITIALISATION of that shape, not an update of it.
 *   - MARIO'S OWN FALL INIT IS THE ROUTINE DIRECTLY ABOVE THE SWEEP, at ROM 0x1F46-0x1F71, and it
 *     is the closest thing to a control: gated on MARIO_START_FALL, it clears MARIO_X_FRAC,
 *     MARIO_Y_FRAC, the horizontal velocity pair, the vertical velocity pair and the frame
 *     counter, then raises MARIO_AIRBORNE. That is exactly the field set this routine and its two
 *     callers write for an object record — the callers supply the horizontal velocity, this
 *     routine the rest. WHICH WAY it launches is where the two differ, and ram.js grounds the
 *     scale: a jump loads +0x0148 into the velocity pair and Mario's fall loads 0. This routine
 *     loads the signed −16 — past the fall end, nowhere near the jump end — and under 0x239C's
 *     law a negative value there makes the gravity slice and the velocity term push the position
 *     the SAME way from frame one, so the motion never turns over.
 *   - The arm selector at +2 is read by the sweep's dispatcher at ROM 0x1F93, which tests bits
 *     0, 1 and 2 in that order and falls through to ROM 0x2053 when none is set. Writing 8 sets
 *     none of them, so this routine moves the record onto the 0x2053 arm — the only arm that
 *     calls 0x239C. Arming the fall and selecting the falling arm are the same act.
 *   - The counter at +14 belongs to that arm: ROM 0x2083 increments it and dispatches on 1 and 2,
 *     and on its later values writes 2 or 4 back into +2, returning the record to one of the two
 *     arms that step OBJ_X by one per frame (ROM 0x1FE5 increments it, ROM 0x1FEF decrements it).
 *     THE MARIO ANALOGY STOPS AT THIS FIELD: +14 of Mario's record is MARIO_AIR_START_Y, which
 *     his fall init writes with his CURRENT Y rather than clearing, so the two records reuse this
 *     offset for unrelated things. Reading a start-Y here would be wrong.
 *   - MEASURED: 42 real dispatches in an 8000-frame 25m attract run, across all 7 record bases
 *     the sweep makes live (0x6700 through 0x67C0), with the accumulator 0 on every one and the
 *     arm selector arriving as 2 or 4 — one of those two OBJ_X-stepping arms — on all 42.
 *
 * WHAT THIS DOES NOT CLAIM. Which way the motion reads ON SCREEN was not observed here; "falling"
 * rests on the sign of the velocity this routine arms, read against the [seen]-grounded jump and
 * fall values of the same field on Mario's record, and not on watching a pixel. Nor does this file
 * say what makes an object start falling: both callers arrive only after their own tests, and
 * both are still frozen.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register instead of becoming
 * a named argument, because the frozen tail at ROM 0x21BA reads that same register directly. A
 * caller passing a different record would be obeyed by these seven stores and ignored one call
 * later. It becomes an honest parameter when 0x21BA is decompiled, not before.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2038.test.js.
 * GATE:     real captures + crafted + live, all ATTRACT and therefore all 25m. Every one of the
 *           42 dispatches in an 8000-frame attract run is replayed — no sampling — and each case
 *           runs the whole frozen chain below (the sprite tail at ROM 0x21BA, the sweep advance
 *           at ROM 0x1F8D and the rest of that frame's ten-slot sweep) on both sides before
 *           anything is compared. The captures are narrow in two ways that matter — the
 *           accumulator is 0 on all 42, and +4 already holds the value being written on 41 of
 *           them — so a crafted arm of 35 entries (one capture per record base, all 7, crossed
 *           with 5 accumulator seeds) pre-poisons all seven written bytes with a value none of
 *           them should be left holding. Compared: the FULL state dump INCLUDING STACK_SCRATCH,
 *           plus pc, SP, every register and the forwarded return value — this rewrite keeps the
 *           oracle's call bracket exactly (a tail jump, so there is no return address beside it)
 *           and performs no stack operation of its own, so all of that legitimately holds and is
 *           asserted rather than excluded. Teeth: five broken twins, and the split is the reason
 *           the crafted arm exists — a twin that writes a literal zero instead of the value it
 *           was handed is caught on 0 of the 42 captures and 28 of the 35 crafted entries, and a
 *           dropped fraction write on 1 of 42 and 35 of 35. Boards 2-4 are not covered and cannot
 *           be: the sweep at ROM 0x1F72 returns unless BOARD is 1, so poking a later board
 *           removes this routine from the run rather than reaching new states.
 * LIVE-OUT: memory only — the seven written record bytes — plus whatever the frozen tail returns,
 *           forwarded unchanged. This routine's own instructions leave EVERY register and EVERY
 *           flag untouched (seven stores, no arithmetic), so there is no register live-out to
 *           derive: what the callers see in the register file after the tail jump belongs
 *           entirely to ROM 0x21BA and the sweep below it, identically on both sides. DERIVED
 *           from the callers as well as the body: there are exactly TWO, ROM 0x1FF6 (a tail jump
 *           at ROM 0x202C) and ROM 0x202F (which runs off its own end into this address), and
 *           neither has a continuation — each returns this routine's value, so nothing above can read a
 *           register this routine did not set. MEASURED, and the measurement is in the gate: the
 *           per-dispatch replay compares the full register file and finds it identical, and
 *           wiring this rewrite live for an 8000-frame attract run (42 real dispatches, asserted)
 *           leaves every frame byte-identical to the all-oracle baseline. The oracle's 143
 *           T-states are restored inside the wiring; without them the run forks on the spin
 *           counter, which is a property of cycle-free code and not of this routine.
 * NAMES:    none imported, and that is not an oversight. Every access is relative to the record
 *           base the sweep supplies, and none of the seven field offsets has a ram.js entry of
 *           its own — they are declared below as file-local constants, in the GATHER_DEST style.
 *           The registry names the prose above leans on are all cells of MARIO's copy of this
 *           record shape or of the sweep's gate — MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_AIR_VY_HI,
 *           MARIO_AIR_VY_LO, MARIO_AIR_FRAMES, MARIO_AIR_START_Y, MARIO_START_FALL,
 *           MARIO_AIRBORNE, OBJ_ARRAY_67, OBJ_X, BOARD — and this routine touches none of them:
 *           it reaches its record through the index register, writes no field the registry names,
 *           and never reads the board. The shared sprite tail at ROM 0x21BA has no idiomatic twin
 *           in ROUTINES yet, so it stays a registry call; this routine JUMPS into it rather than calling it,
 *           so there is no return address to push beside it.
 */

// Record fields written here. None is registered in ram.js — the registry names the shared object
// fields (+0, +3, +5, +7, +8, +9, +10, +13, +24, +26, +27) and these seven are not among them.
// Offsets >= 16 are in-record only for the stride-32 arrays, which is what OBJ_ARRAY_67 is.
const ARM_SELECT = 2; // the sweep dispatcher (ROM 0x1F93) tests bits 0,1,2 of this byte
const X_FRACTION = 4; // low half of the 16.8 horizontal position stepped by ROM 0x239C
const Y_FRACTION = 6; // low half of the 16.8 vertical position stepped by ROM 0x239C
const SUBSTATE = 14; // counter the falling arm's sub-state machine (ROM 0x2083) advances
const INITIAL_VY_HI = 18; // initial vertical velocity, high byte first
const INITIAL_VY_LO = 19;
const AIRBORNE_FRAMES = 20; // frames since launch; ROM 0x239C's gravity slice widens with it

/** The initial vertical velocity this routine arms: signed 16-bit, in 1/256-pixel units. */
const INITIAL_VY = -16;

/** No arm-selector bit set, so the sweep dispatcher falls through to the falling arm. */
const FALLING_ARM = 8;

/** The shared object-sprite tail. Still the frozen oracle. */
const SPRITE_TAIL = 0x21ba;

/**
 * @param {object} m  the machine (memory, and the register file the frozen tail reads).
 * @param {number} resetValue  the value blanked into the four counter/fraction fields. Both
 *   frozen callers clear the accumulator before reaching here and it was 0 on all 42 measured
 *   dispatches; it is a parameter only because they are frozen. Unlike the record base it is
 *   honestly variable — the tail at ROM 0x21BA overwrites the accumulator before reading it, so
 *   nothing downstream re-derives this value from the register.
 * @returns whatever the frozen tail returns, unchanged.
 */
export function loc_2038(
  m,
  resetValue = m.regs.a /* oracle-boundary default: callers 0x1FF6 and 0x202F still frozen */,
) {
  const { mem8 } = m;
  const record = m.regs.ix;

  // Launch downhill rather than upward: with this velocity negative, the gravity term and the
  // velocity term push the position the same way from frame one, so the motion never turns over.
  mem8[record + INITIAL_VY_HI] = INITIAL_VY >> 8;
  mem8[record + INITIAL_VY_LO] = INITIAL_VY;

  // Start the fall from a clean slate: no frames elapsed, no sub-state progress, and both
  // positions exact on their whole pixel.
  mem8[record + AIRBORNE_FRAMES] = resetValue;
  mem8[record + SUBSTATE] = resetValue;
  mem8[record + X_FRACTION] = resetValue;
  mem8[record + Y_FRACTION] = resetValue;

  // Move the record onto the arm that steps that motion every frame.
  mem8[record + ARM_SELECT] = FALLING_ARM;

  return m.call(SPRITE_TAIL);
}
