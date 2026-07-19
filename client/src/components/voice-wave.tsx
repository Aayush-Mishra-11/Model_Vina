"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VoiceWaveProps {
  active?: boolean;
  bars?: number;
  className?: string;
  color?: string;
  stream?: MediaStream | null;
}

export function VoiceWave({ active = true, bars = 28, className, color, stream }: VoiceWaveProps) {
  const [amplitudes, setAmplitudes] = useState<number[]>(new Array(bars).fill(8));
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      setAmplitudes(new Array(bars).fill(8));
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; 
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        const newAmps = [];
        for (let i = 0; i < bars; i++) {
          const dataIndex = Math.floor((i / bars) * bufferLength);
          const val = dataArray[dataIndex] || 0;
          // Scale 0-255 to height range 8px to 48px
          const height = 8 + (val / 255) * 44;
          newAmps.push(height);
        }
        setAmplitudes(newAmps);
        animationRef.current = requestAnimationFrame(draw);
      };

      animationRef.current = requestAnimationFrame(draw);
    } catch (e) {
      console.error("Web Audio API error", e);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [active, stream, bars]);

  const isWebAudioActive = active && !!stream;

  return (
    <div className={cn("flex items-center justify-center gap-[3px] h-14", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        if (isWebAudioActive) {
          return (
            <span
              key={i}
              className="w-[3px] rounded-full transition-[height] duration-75"
              style={{
                background: color ?? "hsl(var(--primary))",
                height: `${amplitudes[i] || 8}px`,
              }}
            />
          );
        }

        // Fallback static CSS animation
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              background: color ?? "hsl(var(--primary))",
              height: 8,
            }}
            animate={
              active
                ? { height: [8, 8 + ((i % 5) + 4) * 5, 8 + ((i % 3) + 2) * 3, 8] }
                : { height: 8 }
            }
            transition={{
              duration: 0.9 + (i % 4) * 0.12,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: (i % 6) * 0.08,
            }}
          />
        );
      })}
    </div>
  );
}
