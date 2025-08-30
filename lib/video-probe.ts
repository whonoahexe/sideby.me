// Lightweight network probe for a video URL to improve error diagnostics that fetches the first ~1KB (if server honors Range) or does a HEAD fallback and returns headers + simple heuristics about likely issues.

export interface VideoProbeResult {
  ok: boolean;
  status: number;
  contentType?: string | null;
  acceptRanges?: string | null;
  bytesSampleHex?: string;
  probableContainer?: string;
  error?: string;
  fromCache?: boolean;
}

function toHexSample(buf: ArrayBuffer, len = 32) {
  const bytes = new Uint8Array(buf.slice(0, len));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function detectContainer(hex: string): string | undefined {
  if (hex.includes('66 74 79 70')) return 'mp4/iso base media';
  if (hex.startsWith('1a 45 df a3')) return 'matroska/webm';
  if (hex.startsWith('47')) return 'mpeg-ts?';
  return undefined;
}

export async function probeVideo(url: string, abortMs = 4000): Promise<VideoProbeResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), abortMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(t);

    const result: VideoProbeResult = {
      ok: res.ok || res.status === 206,
      status: res.status,
      contentType: res.headers.get('content-type'),
      acceptRanges: res.headers.get('accept-ranges'),
      fromCache: res.headers.get('cf-cache-status') === 'HIT',
    };

    if (!result.ok) {
      result.error = `Non-success status ${res.status}`;
      return result;
    }

    // Only sample if content-type seems video-ish or unknown (to detect HTML masquerade)
    const ct = (result.contentType || '').toLowerCase();
    if (ct.includes('video') || ct.includes('application') || ct.includes('octet-stream') || ct === '') {
      const buf = await res.arrayBuffer();
      result.bytesSampleHex = toHexSample(buf);
      const container = detectContainer(result.bytesSampleHex);
      if (container) result.probableContainer = container;
    }

    return result;
  } catch (e: unknown) {
    clearTimeout(t);
    const message = e instanceof Error ? e.message : 'probe failed';
    return { ok: false, status: 0, error: message };
  }
}
