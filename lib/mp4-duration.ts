// Read mvhd from the bounded upload, not a browser-provided duration.
// Unsupported, fragmented/unknown-duration files fail closed for Direct Post.
export function mp4Duration(bytes: Uint8Array): number | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (i: number) => String.fromCharCode(...bytes.subarray(i, i + 4));
  function scan(
    start: number,
    end: number,
    nested: boolean,
  ): number | undefined {
    for (let i = start; i + 8 <= end;) {
      let size = view.getUint32(i),
        header = 8;
      if (size === 1) {
        if (i + 16 > end) return;
        size = Number(view.getBigUint64(i + 8));
        header = 16;
      }
      if (size === 0) size = end - i;
      if (!Number.isSafeInteger(size) || size < header || i + size > end)
        return;
      const type = text(i + 4),
        payload = i + header;
      if (type === "moov" && !nested) {
        const d = scan(payload, i + size, true);
        if (d !== undefined) return d;
      }
      if (type === "mvhd" && nested) {
        const version = bytes[payload];
        const offset = version === 0 ? 12 : version === 1 ? 20 : -1;
        if (
          offset < 0 ||
          payload + offset + (version === 0 ? 8 : 12) > i + size
        )
          return;
        const scale = view.getUint32(payload + offset);
        const ticks =
          version === 0
            ? view.getUint32(payload + offset + 4)
            : Number(view.getBigUint64(payload + offset + 4));
        const duration = ticks / scale;
        return scale && Number.isFinite(duration) && duration > 0
          ? duration
          : undefined;
      }
      i += size;
    }
  }
  return scan(0, bytes.length, false);
}
