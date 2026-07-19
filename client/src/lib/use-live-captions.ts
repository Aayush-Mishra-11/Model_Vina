"use client";

/**
 * Live caption hook — opens a WebSocket to /ws/stt and streams
 * partial transcripts as the user speaks.
 *
 * Usage:
 *   const { liveText, status, startStream, stopStream } = useLiveCaptions({
 *     onFinal: (text) => setTranscript(text),
 *   });
 *   <button onClick={status === "open" ? stopStream : startStream} />
 *   <p>{liveText || "Speak to see live captions…"}</p>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "./env";
import { getStoredToken } from "./axios";

export type LiveCaptionStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface UseLiveCaptionsOptions {
  /** Called when the server sends a partial transcript. */
  onPartial?: (text: string, durationSeconds: number) => void;
  /** Called when the server sends the final transcript. */
  onFinal?: (text: string) => void;
  /** Called when the WebSocket errors out. */
  onError?: (message: string) => void;
  /** Auto-stop after this many ms of recording (0 = no auto-stop). */
  maxDurationMs?: number;
}

export interface UseLiveCaptionsResult {
  liveText: string;
  status: LiveCaptionStatus;
  durationSeconds: number;
  startStream: () => Promise<void>;
  stopStream: () => void;
  sendChunk: (blob: Blob) => void;
  errorMessage: string | null;
}

export function useLiveCaptions(opts: UseLiveCaptionsOptions = {}): UseLiveCaptionsResult {
  const [liveText, setLiveText] = useState("");
  const [status, setStatus] = useState<LiveCaptionStatus>("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStream = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "stop" }));
        }
      } catch {
        // ignore
      }
      try {
        ws.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setStatus("closed");
  }, []);

  const startStream = useCallback(async () => {
    if (wsRef.current) {
      // already streaming
      return;
    }
    setLiveText("");
    setDurationSeconds(0);
    setErrorMessage(null);
    setStatus("connecting");

    const baseUrl = env.apiBaseUrl.replace(/^http/, "ws");
    const url = `${baseUrl}/ws/stt`;
    const token = getStoredToken();

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setStatus("error");
      setErrorMessage("Could not open WebSocket.");
      opts.onError?.("WebSocket construction failed");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            type: "start",
            token: token ?? undefined,
          }),
        );
      } catch (err) {
        // ignore — onerror will fire next
      }
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        setStatus("open");
        if (opts.maxDurationMs && opts.maxDurationMs > 0) {
          autoStopTimerRef.current = setTimeout(() => {
            stopStream();
          }, opts.maxDurationMs);
        }
      } else if (msg.type === "partial") {
        const text = String(msg.text || "");
        const dur = Number(msg.duration || 0);
        setLiveText(text);
        setDurationSeconds(dur);
        opts.onPartial?.(text, dur);
      } else if (msg.type === "final") {
        const text = String(msg.text || "");
        setLiveText(text);
        setStatus("closed");
        opts.onFinal?.(text);
        try {
          ws.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      } else if (msg.type === "error") {
        setStatus("error");
        setErrorMessage(String(msg.message || "Unknown error"));
        opts.onError?.(String(msg.message || "Unknown error"));
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setErrorMessage("WebSocket connection error.");
      opts.onError?.("WebSocket connection error.");
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setStatus((prev) => (prev === "open" ? "closed" : prev));
    };
  }, [opts, stopStream]);

  const sendChunk = useCallback((blob: Blob) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    blob
      .arrayBuffer()
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        try {
          ws.send(JSON.stringify({ type: "chunk", data: b64 }));
        } catch {
          // connection closed mid-flight
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return { liveText, status, durationSeconds, startStream, stopStream, sendChunk, errorMessage };
}
