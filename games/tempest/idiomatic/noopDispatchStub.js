// SPDX-License-Identifier: GPL-3.0-only

/**
 * noopDispatchStub — an empty dispatch slot. ROM 0x9bcf.
 *
 * Role in the machine: a no-op leaf that occupies an entry in a computed-dispatch set.
 * Tempest steers several actions through jump tables indexed by state; some index values
 * are legal but carry no work, and they point here. Selecting this slot falls straight
 * back to the caller with nothing done, which keeps the table dense and the index math
 * simple rather than special-casing the empty cases.
 *
 * Behavior: returns immediately, touching no cells.
 *
 * Live-out: nothing. Grounding: [seen].
 */
export function noopDispatchStub() {}
