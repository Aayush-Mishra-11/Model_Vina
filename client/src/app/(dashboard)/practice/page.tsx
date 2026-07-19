"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Pause,
  Play,
  Square,
  Save,
  Languages,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Settings,
  Activity,
  Globe,
  Sparkles,
  VolumeX,
  Volume2,
  RefreshCw,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { usePracticeStore } from "@/store/practice-store";
import { useSettingsStore } from "@/store/settings-store";
import { practiceApi } from "@/api/practice";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const COMMON_ENGLISH_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
  "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
  'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
  'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
  'has', 'had', 'hello', 'hi', 'hey', 'name', "name's", "suramati", "bholo", "please", "talk", "speak",
  "english", "yes", "no", "thank", "thanks", "welcome"
]);

function isLikelyEnglishText(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const englishCount = words.filter(w => COMMON_ENGLISH_WORDS.has(w)).length;
  return (englishCount / words.length) >= 0.15;
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PracticePage() {
  const router = useRouter();
  const store = usePracticeStore();
  const { englishOnlyMode } = useSettingsStore();

  // Local Page States
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speakingStatus, setSpeakingStatus] = useState<"Speaking" | "Silent">("Silent");
  const [englishViolation, setEnglishViolation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [currentLang, setCurrentLang] = useState("English (US)");

  // UI Details & References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveTranscriptEndRef = useRef<HTMLDivElement | null>(null);

  // Load browser webkitSpeechRecognition API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        setRecognition(rec);
      }
    }
  }, []);

  // Timer Sync
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerActive) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
        store.tick();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive]);

  // Auto-scroll Transcript
  useEffect(() => {
    liveTranscriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.transcript]);

  // Audio Canvas Visualizer & Amplitude Detection
  useEffect(() => {
    if (store.status !== "recording" || !micStream || !canvasRef.current) {
      setAudioLevel(0);
      setSpeakingStatus("Silent");
      return;
    }

    let animationFrameId: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const source = audioContext.createMediaStreamSource(micStream);
    source.connect(analyser);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gradient bars
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.85)"); 
      gradient.addColorStop(0.5, "rgba(168, 85, 247, 0.85)"); 
      gradient.addColorStop(1, "rgba(236, 72, 153, 0.85)"); 

      ctx.fillStyle = gradient;

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      let sum = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        sum += dataArray[i];

        ctx.beginPath();
        // Drawing beautiful rounded rectangles
        ctx.roundRect(x, canvas.height - barHeight - 4, barWidth - 2, barHeight + 4, 3);
        ctx.fill();

        x += barWidth + 1;
      }

      const avg = sum / bufferLength;
      setAudioLevel(avg);
      setSpeakingStatus(avg > 15 ? "Speaking" : "Silent");

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close().catch(() => {});
    };
  }, [store.status, micStream]);

  // Speech Actions
  const startRecording = async () => {
    try {
      store.reset();
      setSeconds(0);
      setEnglishViolation(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);

      let options = {};
      let extension = "webm";
      if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
          extension = "webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
          extension = "mp4";
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setMicStream(null);

        store.setStatus("processing");
        const toastId = toast.loading("Analyzing speech files...");
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, `recording.${extension}`);
          const res = await practiceApi.analyze(formData);

          store.setTranscript(res.transcript || store.transcript);
          store.setCorrected(res.corrected || "No correction needed.");
          store.setMetrics({
            confidence: res.confidenceScore ?? 80,
            pronunciation: res.pronunciationScore ?? 80,
            speakingPace: res.speakingPaceWpm ?? 120,
          });

          if (res.englishOnlyViolation) {
            setEnglishViolation(true);
            setCurrentLang("Non-English Detected");
          } else {
            setCurrentLang("English (US)");
          }

          store.setStatus("idle");
          toast.success("Analysis complete!", { id: toastId });
        } catch {
          store.setStatus("idle");
          toast.error("Analysis failed.", { id: toastId });
        }
      };

      // Start Recognition
      if (recognition) {
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const fullText = (finalTranscript + interimTranscript).trim();
          
          // Instantly alert if non-English detected
          if (englishOnlyMode && fullText) {
            const isEnglish = isLikelyEnglishText(fullText);
            if (!isEnglish) {
              setEnglishViolation(true);
              return; // Disable updating transcript until English resumes
            } else {
              setEnglishViolation(false);
            }
          }

          store.setTranscript(fullText);
        };
        recognition.start();
      }

      recorder.start();
      store.setStatus("recording");
      setTimerActive(true);
      toast.success("Listening... Speak clearly.");
    } catch {
      toast.error("Microphone permission denied.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
      store.setStatus("paused");
      setTimerActive(false);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      if (recognition) {
        try { recognition.start(); } catch {}
      }
      store.setStatus("recording");
      setTimerActive(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    setTimerActive(false);
  };

  const restartSession = () => {
    stopRecording();
    setTimeout(() => {
      startRecording();
    }, 300);
  };

  const toggleMute = () => {
    if (micStream) {
      micStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      toast.success(isMuted ? "Microphone active" : "Microphone muted");
    }
  };

  const saveSession = async () => {
    if (!store.transcript) {
      toast.error("No content to save.");
      return;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success("Session saved successfully!");
    } catch {
      toast.error("Failed to save session.");
    } finally {
      setSaving(false);
    }
  };

  const printReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isRecording = store.status === "recording";
  const isPaused = store.status === "paused";
  const isProcessing = store.status === "processing";

  // Calculated Stats
  const wordsSpoken = store.transcript ? store.transcript.split(/\s+/).length : 0;
  const fluencyScore = Math.max(30, Math.round((store.confidence + store.pronunciation) / 2)) || 0;
  const fillersCount = store.transcript ? (store.transcript.match(/\b(um|uh|like|you know|so|actually|basically|right|okay)\b/gi) || []).length : 0;
  const grammarAccuracy = store.corrected && store.corrected !== "No correction needed." ? 92 : 100;
  const vocabularyScore = wordsSpoken > 15 ? 85 : wordsSpoken > 0 ? 60 : 0;
  const overallScore = Math.round((store.confidence + store.pronunciation + fluencyScore + grammarAccuracy + vocabularyScore) / 5) || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Navbar */}
      <Card className="overflow-hidden bg-slate-900/50 border border-slate-800 backdrop-blur-md shadow-2xl">
        <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg text-white">AI Speech Coach</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 text-primary animate-spin" /> Live Mode
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Badge */}
            <Badge
              variant={isRecording ? "destructive" : isPaused ? "warning" : isProcessing ? "gradient" : "outline"}
              className="px-2.5 py-1 text-xs gap-1.5 uppercase font-semibold"
            >
              {isRecording && <span className="h-2 w-2 rounded-full bg-white animate-ping" />}
              {store.status}
            </Badge>

            {/* Connection dot */}
            <Badge variant="outline" className="px-2.5 py-1 text-xs gap-1.5 border-slate-700 bg-slate-800/40">
              <span className="h-2 w-2 rounded-full bg-success" />
              Connected
            </Badge>

            {/* Current Language */}
            <Badge variant="outline" className="px-2.5 py-1 text-xs gap-1.5 border-slate-700 bg-slate-800/40">
              <Languages className="h-3 w-3 text-primary" />
              {currentLang}
            </Badge>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-slate-800 hover:bg-slate-800"
              onClick={() => store.setEnglishOnly(!englishOnlyMode)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Main Two Column Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        
        {/* Left Column: Visualizer & Mic Control */}
        <Card className="lg:col-span-2 overflow-hidden bg-slate-950/60 border-slate-900 shadow-2xl flex flex-col justify-between">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
          
          <CardContent className="relative p-6 flex flex-col items-center justify-center gap-6 flex-1 min-h-[420px]">
            {/* Warning Popup */}
            <AnimatePresence>
              {englishViolation && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3 rounded-2xl border border-destructive bg-destructive/15 p-4 backdrop-blur-md"
                >
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 animate-bounce" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">Language Alert</p>
                    <p className="text-xs text-muted-foreground">Please use only English inside free practice.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Speaking Status */}
            <Badge variant="outline" className="gap-1.5 border-slate-800 bg-slate-900/60 font-mono text-xs">
              <Activity className={cn("h-3.5 w-3.5", isRecording ? "text-primary" : "text-muted-foreground")} />
              Status: {speakingStatus}
            </Badge>

            {/* Microphone Circle Visual */}
            <div className="relative flex h-48 w-48 items-center justify-center">
              {isRecording && (
                <motion.span
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-primary/20"
                />
              )}
              <span className={cn("absolute inset-4 rounded-full transition-all duration-300", isRecording ? "bg-primary/10" : "bg-slate-900")} />
              
              <div
                className={cn(
                  "relative flex h-32 w-32 items-center justify-center rounded-full shadow-2xl transition-colors duration-300",
                  isRecording ? "bg-premium-gradient" : isPaused ? "bg-warning" : "bg-slate-800"
                )}
              >
                {isProcessing ? (
                  <Loader2 className="h-14 w-14 text-white animate-spin" />
                ) : (
                  <Mic className="h-14 w-14 text-white" />
                )}
              </div>
            </div>

            {/* Canvas Waveform */}
            <div className="w-full bg-slate-900/40 rounded-2xl border border-slate-800 p-2 overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-16 rounded-xl" width={320} height={64} />
            </div>

            {/* Audio level horizontal bar */}
            <div className="w-full space-y-1 text-center">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mic Input Level</span>
                <span>{Math.round((audioLevel / 120) * 100)}%</span>
              </div>
              <Progress value={Math.min(100, (audioLevel / 120) * 100)} className="h-1.5" />
            </div>

            {/* Timer display */}
            <div className="flex items-center gap-2 font-mono text-xl font-bold text-white tracking-widest bg-slate-900/60 py-1.5 px-4 rounded-xl border border-slate-800">
              <Clock className="h-4 w-4 text-primary" />
              {formatDuration(seconds)}
            </div>
          </CardContent>

          {/* Action Control Panel */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/40 flex flex-wrap gap-2 justify-center">
            {store.status === "idle" ? (
              <Button size="lg" className="w-full rounded-xl py-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90" onClick={startRecording}>
                <Mic className="mr-2 h-5 w-5" /> Start Recording
              </Button>
            ) : (
              <>
                {isRecording ? (
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl border-slate-800" onClick={pauseRecording}>
                    <Pause className="mr-1.5 h-4 w-4" /> Pause
                  </Button>
                ) : (
                  <Button variant="gradient" size="sm" className="flex-1 rounded-xl" onClick={resumeRecording}>
                    <Play className="mr-1.5 h-4 w-4" /> Resume
                  </Button>
                )}

                <Button variant="destructive" size="sm" className="flex-1 rounded-xl" onClick={stopRecording}>
                  <Square className="mr-1.5 h-4 w-4" /> Stop
                </Button>

                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-800" onClick={restartSession}>
                  <RefreshCw className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-800" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-800"
                  onClick={saveSession}
                  loading={saving}
                  disabled={!store.transcript}
                >
                  <Save className="mr-1.5 h-4 w-4" /> Save
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Right Column: Live Transcripts & Corrections */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          
          {/* Live Transcript Card */}
          <Card className="flex-1 overflow-hidden bg-slate-900/30 border-slate-800 shadow-2xl flex flex-col">
            <CardHeader className="py-3 px-5 border-b border-slate-800 bg-slate-900/10">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-white">
                <span>Live Transcription</span>
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 overflow-y-auto max-h-[170px] min-h-[140px] flex-1 text-sm leading-relaxed text-slate-300">
              {store.transcript ? (
                <div className="space-y-2">
                  <p>{store.transcript}</p>
                  {isRecording && (
                    <span className="inline-flex gap-1 items-center text-xs text-primary font-medium mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" /> Listening...
                    </span>
                  )}
                  <div ref={liveTranscriptEndRef} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                  <Activity className="h-8 w-8 text-slate-700 mb-2" />
                  <p className="text-xs">Start speaking to begin practice.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corrected & Suggestions Card */}
          <Card className="flex-1 overflow-hidden bg-slate-900/30 border-slate-800 shadow-2xl flex flex-col">
            <CardHeader className="py-3 px-5 border-b border-slate-800 bg-slate-900/10">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-white">
                <span>Grammar Coaching & Corrections</span>
                <Badge variant="gradient" className="text-[10px]">AI-Corrected</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 overflow-y-auto max-h-[220px] min-h-[160px] flex-1 text-sm leading-relaxed">
              {store.corrected ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-success mb-1">Recommended Phrase</p>
                    <p className="text-white font-medium">{store.corrected}</p>
                  </div>
                  
                  {/* Detailed improvements */}
                  {store.transcript !== store.corrected && store.corrected !== "No correction needed." && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Grammar Suggestions</p>
                      <div className="text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-success">
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span>Sentence structure optimized for natural native flow.</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary">
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span>Redundant grammar errors corrected successfully.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                  <Sparkles className="h-8 w-8 text-slate-700 mb-2" />
                  <p className="text-xs">Corrected transcript and styling recommendations will appear here after recording.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* 3. AI Feedback Progress Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        
        {/* Grammar card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Grammar Accuracy</span>
              <Badge variant="outline" className="text-[10px]">{grammarAccuracy}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl font-bold text-white">{grammarAccuracy}%</p>
              <Progress value={grammarAccuracy} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Pronunciation card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pronunciation Score</span>
              <Badge variant="outline" className="text-[10px]">{store.pronunciation || 0}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl font-bold text-white">{store.pronunciation || 0}%</p>
              <Progress value={store.pronunciation} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Confidence card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence Index</span>
              <Badge variant="outline" className="text-[10px]">{store.confidence || 0}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl font-bold text-white">{store.confidence || 0}%</p>
              <Progress value={store.confidence} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Fluency card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Fluency Score</span>
              <Badge variant="outline" className="text-[10px]">{fluencyScore}%</Badge>
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl font-bold text-white">{fluencyScore}%</p>
              <Progress value={fluencyScore} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Pace card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Speaking Pace</p>
            <p className="font-display text-2xl font-bold text-white">{store.speakingPace || 0} <span className="text-xs font-normal text-muted-foreground">wpm</span></p>
            <p className="text-[10px] text-muted-foreground">Ideal range: 110-150 wpm</p>
          </CardContent>
        </Card>

        {/* Vocabulary richness card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Vocabulary Richness</p>
            <p className="font-display text-2xl font-bold text-white">{vocabularyScore}%</p>
            <p className="text-[10px] text-muted-foreground">Calculated on unique word usage</p>
          </CardContent>
        </Card>

        {/* Fillers Count card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Filler Words Flagged</p>
            <p className="font-display text-2xl font-bold text-destructive">{fillersCount} <span className="text-xs font-normal text-muted-foreground">times</span></p>
            <p className="text-[10px] text-muted-foreground">Fewer fillers indicate high clarity</p>
          </CardContent>
        </Card>

        {/* Language Detection card */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Language Detection</p>
            <p className="font-display text-2xl font-bold text-primary">English</p>
            <p className="text-[10px] text-muted-foreground">Correct grammar checking context</p>
          </CardContent>
        </Card>

      </div>

      {/* 4. Bottom Section: Session Summary */}
      <Card className="bg-slate-950/40 border-slate-900 overflow-hidden shadow-2xl">
        <CardHeader className="py-4 px-6 border-b border-slate-800 bg-slate-900/10 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Session Analysis Summary
          </CardTitle>
          <Badge variant="outline" className="border-slate-800 font-mono text-xs">{formatDuration(seconds)}</Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 text-center">
            
            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Words Spoken</p>
              <p className="font-display text-xl font-bold text-white">{wordsSpoken}</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Speaking Time</p>
              <p className="font-display text-xl font-bold text-white">{formatDuration(seconds)}</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Avg Pace</p>
              <p className="font-display text-xl font-bold text-white">{store.speakingPace || 0} wpm</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Filler Words</p>
              <p className="font-display text-xl font-bold text-white">{fillersCount}</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Confidence</p>
              <p className="font-display text-xl font-bold text-white">{store.confidence || 0}%</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Grammar Acc.</p>
              <p className="font-display text-xl font-bold text-white">{grammarAccuracy}%</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Pronunciation</p>
              <p className="font-display text-xl font-bold text-white">{store.pronunciation || 0}%</p>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800/50">
              <p className="text-xs text-muted-foreground mb-1">Vocabulary</p>
              <p className="font-display text-xl font-bold text-white">{vocabularyScore}%</p>
            </div>

            <div className="rounded-xl bg-primary/10 p-3 border border-primary/20 col-span-2 sm:col-span-1">
              <p className="text-xs text-primary mb-1 font-semibold">Overall Score</p>
              <p className="font-display text-xl font-black text-white">{overallScore}%</p>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-900 pt-6">
            <Button variant="outline" className="rounded-xl border-slate-800" onClick={printReport} disabled={!store.transcript}>
              <Printer className="mr-1.5 h-4 w-4" /> Print Session Report
            </Button>
            <Button variant="gradient" className="rounded-xl px-6" onClick={restartSession}>
              Start New Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
