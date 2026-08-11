#!/usr/bin/env python3
"""Generate a SEMANTIC (annotated) disassembly of the Time Pilot main-CPU ROM.

Merges the raw reachability-driven disassembly (games/timeplt/out/dk.asm, read-only)
with English routine names, work-RAM cell names, and roles built LIVE from the
idiomatic layer, added as trailing `;` comments. Output is games/timeplt/out/
timeplt-semantic.asm; raw dk.asm is never modified. The output carries the ROM byte
stream (like dk.asm), so it is gitignored/never committed -- this TOOL is the shipped
artifact (original RE, no ROM bytes; reads dk.asm at runtime). Each run self-tests
losslessness (strip the annotations and it is byte-identical to raw dk.asm) and asserts
no invented names. See README-semantic-disasm.md for the maps, rules, and guarantees.
"""

import glob
import os
import re
import sys
import textwrap

# This tool lives at games/timeplt/tools/; GAME is two directories up (no absolute paths).
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(GAME, "out/dk.asm")
OUT = os.path.join(GAME, "out/timeplt-semantic.asm")
NAMES = os.path.join(GAME, "idiomatic/names.js")
TESTDIR = os.path.join(GAME, "idiomatic/test")
IDIODIR = os.path.join(GAME, "idiomatic")

ANNOT_COL = 56          # right-hand column where inline annotations begin
ROLE_WRAP = 106         # role text wrap width (+2 for "; " prefix stays < 110)
ROM_BRANCH = ("call", "jp", "jr", "djnz")


# --------------------------------------------------------------------------- maps
def build_cell_map():
    """0xADDR -> UPPER_NAME from names.js `export const NAME = 0xADDR;`."""
    m = {}
    for line in open(NAMES):
        mm = re.match(r"^export const ([A-Z_0-9]+) = (0x[0-9a-f]{4});", line)
        if mm:
            m[int(mm.group(2), 16)] = mm.group(1)
    return m


def build_routine_map():
    """0xADDR -> EnglishName from the equivalence-test manifest (see README).

    Address from the filename (equivalence-<addr>.test.js); name from the first
    idiomatic import, matched across newlines (skip oracle/_harness/names);
    loc_<addr> stubs excluded. The exported symbol equals its filename here.
    """
    imp = re.compile(r'import\s*\{[^}]*\}\s*from\s*"([^"]+)"\s*;', re.S)
    m = {}
    for path in sorted(glob.glob(os.path.join(TESTDIR, "equivalence-*.test.js"))):
        addr = int(re.search(r"equivalence-([0-9a-f]+)\.test\.js", path).group(1), 16)
        text = open(path).read()
        name = None
        for mm in imp.finditer(text):
            fm = re.fullmatch(r"\.\./([A-Za-z0-9_]+)\.js", mm.group(1))
            if not fm:
                continue
            fn = fm.group(1)
            if fn in ("_harness", "names"):
                continue
            name = fn
            break
        if name and not name.startswith("loc_"):
            # NO invented names: the idiomatic source file must actually exist.
            assert os.path.exists(os.path.join(IDIODIR, name + ".js")), \
                f"routine name {name!r} (addr {addr:#06x}) has no idiomatic file"
            m[addr] = name
    return m


def build_role_map():
    """0xADDR -> (name, role, cert) from the ROUTINES table in names.js."""
    text = open(NAMES).read()
    rx = re.compile(
        r'^  (0x[0-9a-f]{4}): \{ name: "([^"]*)", role: "(.*)", cert: "([^"]*)" \},\s*$',
        re.M,
    )
    m = {}
    for a, n, r, c in rx.findall(text):
        m[int(a, 16)] = (n, r, c)
    return m


# ----------------------------------------------------------------------- transform
label_re = re.compile(r"^(loc_([0-9a-f]+)):\s*$")
instr_re = re.compile(r"^    [a-z]")  # 4 spaces + mnemonic (data-comment lines start "    ;")
op_addr_re = re.compile(r"0x([0-9a-f]{4})")


def instr_annotation(code_part, cell_map, routine_map):
    """Operand note, or None: a ROM branch target -> `-> RoutineName`; a named RAM
    cell operand -> its CELL name; `dw` data words are left alone. See README."""
    mnem = code_part.split(None, 1)[0]
    tm = op_addr_re.search(code_part)
    if tm is None:
        return None
    addr = int(tm.group(1), 16)
    if mnem in ROM_BRANCH:
        if addr in routine_map:
            return "-> " + routine_map[addr]
        return None
    if mnem == "dw":
        return None
    if addr in cell_map:
        return cell_map[addr]
    return None


def main():
    cell_map = build_cell_map()
    routine_map = build_routine_map()
    role_map = build_role_map()

    # Overlap / sanity assertions (the spec asked us to flag these explicitly).
    both = set(cell_map) & set(routine_map)
    assert not both, f"address is BOTH a cell and a routine: {sorted(hex(a) for a in both)}"
    # Every role address is a known routine (or an unnamed trap whose name is loc_).
    for a, (n, _r, _c) in role_map.items():
        assert a in routine_map or n.startswith("loc_"), \
            f"role addr {a:#06x} not in routine map and not a loc_ trap"

    raw = open(RAW).read()
    raw_lines = raw.split("\n")

    # records: each dict is one OUTPUT line.
    #   origin 'raw'    -> reproduces raw_lines[rawidx] after stripping `suffix`
    #                      (and reversing `swap` when set)
    #   origin 'insert' -> a brand-new comment line (role block / header note)
    records = []

    def emit_raw(rawidx, text, suffix="", swap=False):
        # the OUTPUT line is the raw line WITH the annotation appended; `suffix`
        # is also recorded so the self-test can strip it back off.
        records.append({"origin": "raw", "rawidx": rawidx, "text": text + suffix,
                        "suffix": suffix, "swap": swap})

    def emit_insert(text):
        records.append({"origin": "insert", "text": text})

    # bookkeeping / stats
    inlined_names = set()   # every routine name inlined (for the no-invention assert)
    inlined_cells = set()   # every cell name inlined
    stats = dict(labels_named=0, labels_left=0, ram_refs=0, rom_refs=0,
                 roles_inlined=0)
    header_note_done = False

    for i, line in enumerate(raw_lines):
        # ---- header: swap the game name, add a provenance note ----
        if "Donkey Kong maincpu" in line:
            emit_raw(i, line.replace("Donkey Kong maincpu", "Time Pilot maincpu"),
                     swap=True)
            continue
        if not header_note_done and line.startswith("; Generated by tools/trace.py"):
            emit_raw(i, line)
            emit_insert("; Semantic layer: routine names, cell names, and roles merged from the")
            emit_insert(";   idiomatic layer (games/timeplt/idiomatic/) by")
            emit_insert(";   games/timeplt/tools/gen_semantic_disasm.py. The raw instruction stream is unchanged;")
            emit_insert(";   annotations are trailing `;` comments only and strip back to dk.asm.")
            header_note_done = True
            continue

        # ---- labels ----
        lm = label_re.match(line)
        if lm:
            addr = int(lm.group(2), 16)
            # role block (wrapped) ABOVE the label, if this addr has a role
            if addr in role_map:
                rname, rtext, _cert = role_map[addr]
                emit_insert("; " + "=" * 3 + " " + rname + " " + "=" * 3)
                for wl in textwrap.wrap(rtext, ROLE_WRAP):
                    emit_insert("; " + wl)
                stats["roles_inlined"] += 1
            # name the label if it is a lifted routine head
            if addr in routine_map:
                name = routine_map[addr]
                emit_raw(i, line, suffix="  ; " + name)
                inlined_names.add(name)
                stats["labels_named"] += 1
            else:
                emit_raw(i, line)
                stats["labels_left"] += 1
            continue

        # ---- instructions ----
        if instr_re.match(line):
            code_part = line.split("; ", 1)[0].rstrip()
            note = instr_annotation(code_part, cell_map, routine_map)
            if note is not None:
                pad = max(2, ANNOT_COL - len(line))
                suffix = " " * pad + "; " + note
                emit_raw(i, line, suffix=suffix)
                if note.startswith("-> "):
                    stats["rom_refs"] += 1
                    inlined_names.add(note[3:])
                else:
                    stats["ram_refs"] += 1
                    inlined_cells.add(note)
                continue

        # ---- everything else: passthrough ----
        emit_raw(i, line)

    # -------------------------------------------------- no-invented-names assertion
    routine_values = set(routine_map.values())
    cell_values = set(cell_map.values())
    bad_names = inlined_names - routine_values
    bad_cells = inlined_cells - cell_values
    assert not bad_names, f"inlined names not in routine map: {sorted(bad_names)}"
    assert not bad_cells, f"inlined cells not in cell map: {sorted(bad_cells)}"

    # ---------------------------------------------------------------- write output
    out_text = "\n".join(rec["text"] for rec in records)
    with open(OUT, "w") as fh:
        fh.write(out_text)

    # ------------------------------------------------------------ lossless self-test
    # Re-read the file we just wrote and reconstruct the raw code from it, so the
    # check runs against bytes ON DISK, not just the in-memory model.
    disk_lines = open(OUT).read().split("\n")
    assert len(disk_lines) == len(records), \
        f"on-disk line count {len(disk_lines)} != records {len(records)}"

    recon_idx, recon_line = [], []
    for rec, disk in zip(records, disk_lines):
        assert rec["text"] == disk, "on-disk line differs from generated line"
        if rec["origin"] == "insert":
            continue
        stripped = disk
        if rec["suffix"]:
            assert stripped.endswith(rec["suffix"]), "annotation suffix missing on disk"
            stripped = stripped[: -len(rec["suffix"])]   # <-- strip the annotation
        if rec["swap"]:
            stripped = stripped.replace("Time Pilot maincpu", "Donkey Kong maincpu")
        recon_idx.append(rec["rawidx"])
        recon_line.append(stripped)

    ok_order = recon_idx == list(range(len(raw_lines)))
    ok_bytes = all(recon_line[k] == raw_lines[k] for k in range(len(raw_lines))) \
        if ok_order else False

    # Headline (spec wording): CODE lines -- labels + instruction lines -- identical.
    code_idx = [k for k, l in enumerate(raw_lines)
                if label_re.match(l) or instr_re.match(l)]
    code_ok = ok_order and all(recon_line[k] == raw_lines[k] for k in code_idx)
    lossless = ok_order and ok_bytes and code_ok

    # ------------------------------------------------------------------------ report
    print(f"tool   : games/timeplt/tools/gen_semantic_disasm.py")
    print(f"input  : {RAW}")
    print(f"output : {OUT}")
    print(f"maps   : cells={len(cell_map)}  routines={len(routine_map)}  roles={len(role_map)}")
    print("stats  :")
    print(f"  loc_ labels NAMED          : {stats['labels_named']}")
    print(f"  loc_ labels left as loc_   : {stats['labels_left']}")
    print(f"  RAM cell refs annotated    : {stats['ram_refs']}")
    print(f"  call/jp/jr targets annotated: {stats['rom_refs']}")
    print(f"  role blocks inlined        : {stats['roles_inlined']}")
    print(f"  distinct cells inlined     : {len(inlined_cells)}")
    print(f"  distinct routines inlined  : {len(inlined_names)}")
    print("self-test:")
    print(f"  every raw line recovered in order : {ok_order}")
    print(f"  full byte-identity to raw dk.asm  : {ok_bytes}")
    print(f"  code-line byte-identity (headline): {code_ok}  ({len(code_idx)} code lines)")
    print(f"  LOSSLESS ROUNDTRIP                 : {'PASS' if lossless else 'FAIL'}")
    if not lossless:
        for k in range(len(raw_lines)):
            if not ok_order or recon_line[k] != raw_lines[k]:
                print(f"  first diff @raw line {k}: {raw_lines[k]!r} != {recon_line[k]!r}")
                break
        sys.exit(1)


if __name__ == "__main__":
    main()
