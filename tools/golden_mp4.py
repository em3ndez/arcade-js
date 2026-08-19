#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# golden_mp4.py -- compress a MAME golden's frames.rgb to a lossless x264rgb .mp4 and decode it back.
# libx264rgb -qp 0 encodes RGB directly (no YUV round-trip) so it is BYTE-EXACT, and frame-to-frame
# coherence shrinks a 180 s attract golden ~300x (~1.7 GB -> ~6 MB). Readers still consume frames.rgb:
# run `decode` before a diff session, `compress` (--drop-rgb) after a capture to keep the golden small.
# frames.json's per-frame sha256 is the oracle -- every path verifies against it and fails closed,
# never leaving a partial or lossy frames.rgb behind for a reader to diff.
import argparse
import hashlib
import json
import os
import subprocess
import tempfile


def _load_index(golden_dir):
    path = os.path.join(golden_dir, "frames.json")
    if not os.path.exists(path):
        raise SystemExit(f"missing {path} -- need the golden's sha256 index to verify losslessness")
    with open(path) as fh:
        idx = json.load(fh)
    w, h, bpf = idx["width"], idx["height"], idx["bytes_per_frame"]
    if bpf != w * h * 3:
        raise SystemExit(f"frames.json bytes_per_frame {bpf} != {w}*{h}*3")
    hashes = [f["sha256"] for f in idx["frames"]]
    if len(hashes) != idx["count"]:
        raise SystemExit("frames.json count != len(frames)")
    return w, h, bpf, hashes


def _verify_rgb(rgb_path, bpf, hashes):
    size = os.path.getsize(rgb_path)
    if size != len(hashes) * bpf:
        raise SystemExit(f"{rgb_path}: {size} bytes != {len(hashes)} frames * {bpf}")
    with open(rgb_path, "rb") as fh:
        for i, want in enumerate(hashes):
            if hashlib.sha256(fh.read(bpf)).hexdigest() != want:
                raise SystemExit(f"{rgb_path}: frame {i} sha256 mismatch -- NOT lossless")


def _encode(rgb_path, mp4_path, w, h):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{w}x{h}", "-r", "60", "-i", rgb_path,
         "-c:v", "libx264rgb", "-qp", "0", "-y", mp4_path],
        check=True,
    )


def _decode(mp4_path, rgb_path, w, h):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", mp4_path, "-map", "0:v:0",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-y", rgb_path],
        check=True,
    )


def compress(golden_dir, drop_rgb):
    w, h, bpf, hashes = _load_index(golden_dir)
    rgb = os.path.join(golden_dir, "frames.rgb")
    mp4 = os.path.join(golden_dir, "frames.mp4")
    if not os.path.exists(rgb):
        raise SystemExit(f"missing {rgb}")
    _encode(rgb, mp4, w, h)
    # verify the mp4 decodes byte-exact BEFORE dropping the raw source
    with tempfile.TemporaryDirectory() as td:
        check = os.path.join(td, "check.rgb")
        _decode(mp4, check, w, h)
        _verify_rgb(check, bpf, hashes)
    print(f"compress: {os.path.getsize(rgb)} -> {os.path.getsize(mp4)} bytes (verified byte-exact)")
    if drop_rgb:
        os.remove(rgb)
        print(f"dropped {rgb}")


def decode(golden_dir):
    w, h, bpf, hashes = _load_index(golden_dir)
    mp4 = os.path.join(golden_dir, "frames.mp4")
    rgb = os.path.join(golden_dir, "frames.rgb")
    if not os.path.exists(mp4):
        raise SystemExit(f"missing {mp4}")
    _decode(mp4, rgb, w, h)
    try:
        _verify_rgb(rgb, bpf, hashes)
    except BaseException:
        if os.path.exists(rgb):
            os.remove(rgb)  # never leave a wrong/partial frames.rgb for a reader to diff
        raise
    print(f"decode: {os.path.getsize(mp4)} -> {os.path.getsize(rgb)} bytes (verified byte-exact)")


def selftest():
    w, h, n, bpf = 16, 16, 8, 16 * 16 * 3
    with tempfile.TemporaryDirectory() as td:
        seed = 0x1234  # fixed LCG: deterministic frames with full chroma variation
        buf = bytearray()
        for _ in range(n * bpf):
            seed = (1103515245 * seed + 12345) & 0x7FFFFFFF
            buf.append((seed >> 16) & 0xFF)
        rgb_path = os.path.join(td, "frames.rgb")
        open(rgb_path, "wb").write(buf)
        hashes = [hashlib.sha256(bytes(buf[i * bpf:(i + 1) * bpf])).hexdigest() for i in range(n)]
        json.dump({"width": w, "height": h, "bytes_per_frame": bpf, "count": n,
                   "frames": [{"i": i, "sha256": hh} for i, hh in enumerate(hashes)]},
                  open(os.path.join(td, "frames.json"), "w"))
        compress(td, drop_rgb=False)
        os.remove(rgb_path)
        decode(td)
        if open(rgb_path, "rb").read() != bytes(buf):
            raise SystemExit("selftest: lossless round-trip is NOT byte-exact")
        # positive control: a YUV codec (libx264, not libx264rgb) must FAIL verification
        lossy = os.path.join(td, "lossy.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                        "-s", f"{w}x{h}", "-r", "60", "-i", rgb_path,
                        "-c:v", "libx264", "-qp", "0", "-y", lossy], check=True)
        lossy_rgb = os.path.join(td, "lossy.rgb")
        _decode(lossy, lossy_rgb, w, h)
        try:
            _verify_rgb(lossy_rgb, bpf, hashes)
        except SystemExit:
            print("selftest: OK -- lossless round-trip byte-exact; lossy YUV correctly rejected")
            return
        raise SystemExit("selftest: positive control FAILED -- a lossy encode passed verification")


def main():
    p = argparse.ArgumentParser(description="Lossless mp4 compress/decode for a MAME golden's frames.rgb")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("compress")
    c.add_argument("golden_dir")
    c.add_argument("--drop-rgb", action="store_true", help="remove frames.rgb after verifying the mp4")
    d = sub.add_parser("decode")
    d.add_argument("golden_dir")
    sub.add_parser("selftest")
    args = p.parse_args()
    if args.cmd == "compress":
        compress(args.golden_dir, args.drop_rgb)
    elif args.cmd == "decode":
        decode(args.golden_dir)
    else:
        selftest()


if __name__ == "__main__":
    main()
