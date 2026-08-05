// SPDX-License-Identifier: GPL-3.0-only

/**
 * Time Pilot work-RAM constants for the idiomatic layer.
 *
 * Maps this game's work RAM (0xA800-0xAFFF) to meaningful names. Addresses stay hex in
 * `../translated/` on purpose — that layer is the oracle; this file is a naming convenience for
 * the idiomatic rewrite and is NEVER the source of truth for behaviour.
 *
 * ★ PROVENANCE / CONFIDENCE (be honest — a wrong name is the sprite-record trap, worse than a
 * neutral hex address). Every name carries an evidence-source tag saying HOW we know the role:
 *   [seen]  — observed under MAME: a capture watched THIS address and confirmed what it does.
 *   [code]  — understood from the routines that touch it: consistent across them, but the cell
 *             itself was not observed.
 *   [guess] — one plausible reading, not confirmed; treat as a hint and verify.
 *   keep-hex — no confident name, so no const exists; the absence of an entry IS the signal.
 * The pixel gate, not the name, remains the correctness authority.
 */

/**
 * Sequence step for the jump-table state machine. [code]
 *
 * One reader masks this to its low nibble and dispatches through a word table on the result, so
 * it is an index rather than a count. One routine's only job is to increment it; another clears
 * it to restart the sequence. Touched across nineteen transcribed routines, consistently as an
 * index. Not yet observed under a capture, so the *identity* is code-derived: which sequence it
 * steps (attract, round intro, or both) is NOT established and this name does not claim it.
 */
export const SEQUENCE_STEP = 0xa9ac;

/**
 * Mirror of the IN0 input port, rewritten every frame from the port itself. [seen]
 *
 * The vblank service reads the port, complements it (the hardware is active-low) and stores the
 * result here, unconditionally — so this cell reflects what the panel is asserting, not what the
 * machine decided to do about it. Bit 0 is coin 1, bit 3 is 1-player start; watched under a
 * capture, it carries exactly the bits a driven tape held, for exactly the frames it held them.
 * Because the write is unconditional, a non-zero value proves a button was down and nothing more.
 */
export const IN0_MIRROR = 0xa9ae;

/**
 * Set when the machine ACCEPTS a coin, as distinct from merely seeing the button. [seen]
 *
 * Reads zero for the whole of an undriven run, and goes non-zero on the frame a driven coin is
 * taken, holding for a short spell before clearing. Unlike the port mirror this is downstream of
 * the machine's own decision, which is what makes it usable as evidence that a credit banked.
 */
export const COIN_ACCEPTED = 0xa981;

/**
 * Flag set while play is active. [seen]
 *
 * A true boolean rather than a value: one routine stores all-ones into it, three others clear it
 * with an exclusive-or of the accumulator, and a reader tests it for zero and returns early when
 * it is set. Watched under captures it reads zero for the whole of two undriven runs totalling
 * over five thousand frames, goes all-ones on the frame a driven start press lands, and holds
 * for every remaining frame.
 *
 * What this name does NOT claim: the exact scope of "active". Whether it spans a whole credit,
 * a single life, or the interval between round transitions is not established — only that it is
 * set once play begins and is not set during attract.
 */
export const PLAY_ACTIVE = 0xad30;

/**
 * Address -> idiomatic routine. Artifact three of the four: a module that is not in here is
 * never dispatched, so it is written-and-never-executed no matter how green its own gate is.
 *
 * `name` IS the filename (`./<name>.js`), one-to-one. `entry` overrides the export name only
 * where a routine is deliberately a pure function of its inputs rather than a `fn(m)`.
 * `cert` uses the same evidence vocabulary as the cell names above.
 */
/**
 * OPEN QUESTION, for the understanding pass. Two routines here retire an object and their caller
 * sets are DISJOINT — one serves the family in the lower band, the other the family in the upper.
 * They are not a partial and a complete version of one helper. The mechanical difference is that
 * one zeroes each coordinate whole and the other leaves the sub-pixel remainders standing, and
 * nobody has yet grounded whether those surviving remainders matter when a slot is reused. Until
 * that is settled the two verbs are synonyms carrying none of the distinction, which is a naming
 * defect this registry is recording rather than hiding.
 */
export const ROUTINES = {
  0x0008: {
    name: "loc_0008",
    role: "step a table pointer on by an index and return the byte it lands on, leaving the pointer at that entry",
    cert: "code",
  },
  0x0018: {
    name: "loc_0018",
    role: "move a 16-bit address forward by an unsigned byte offset, echoing the low half of the result back",
    cert: "code",
  },
  0x0020: {
    name: "loc_0020",
    role: "step the character-cell cursor on to the next cell of the line being drawn",
    cert: "code",
  },
  0x0038: {
    name: "loc_0038",
    role: "queue a command byte and its argument in the main command ring, dropping the pair when the cursor's cell is still occupied",
    cert: "code",
  },
  0x0f1a: {
    name: "loc_0f1a",
    role: "step the jump-table sequence index on by one; reached as a tail jump so the caller's own return carries it",
    cert: "code",
  },
  0x2b60: {
    name: "loc_2b60",
    role: "add the frame's world-scroll displacement to one object's two split 16-bit coordinates",
    cert: "code",
  },
  0x2bde: {
    name: "loc_2bde",
    role: "take an object out of play, zeroing each coordinate WHOLE — occupancy byte, both sub-pixel remainders, and both sprite-entry coordinates",
    cert: "code",
  },
  0x2b83: {
    name: "loc_2b83",
    role: "answer whether an actor has drifted onto either of two fixed retire lines, within a narrow wrapped window, which is what makes its caller free the slot",
    cert: "code",
  },
  0x309b: {
    name: "loc_309b",
    role: "step the record cursor and the parallel sprite-entry cursor on to the next object slot",
    cert: "code",
  },
  0x40ab: {
    name: "loc_40ab",
    role: "retire an object, zeroing only the INTEGER halves — occupancy byte and both sprite-entry coordinates — leaving the sub-pixel remainders standing",
    cert: "code",
  },
};
