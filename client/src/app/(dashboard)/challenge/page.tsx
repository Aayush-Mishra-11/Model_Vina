"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Mic,
  Square,
  Clock,
  Award,
  Sparkles,
  Loader2,
  CheckCircle2,
  HelpCircle,
  FileText,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/dashboard/section-header";
import { challengeApi, type DailyChallenge } from "@/api/challenge";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ChallengeResult {
  score: number;
  reward: string;
  transcript: string;
  feedback: string;
}

export default function ChallengePage() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  // Recording states
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Submit and result states
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch challenge of today & user history
  const loadChallengeData = async () => {
    try {
      setLoading(true);
      const today = await challengeApi.today();
      setChallenge(today);
      const hist = await challengeApi.list();
      setHistory(hist);
    } catch (err) {
      toast.error("Failed to load today's daily challenge.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallengeData();
  }, []);

  // Timer runner
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      setAudioChunks([]);
      setTime(0);
      setResult(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      const recorder = new MediaRecorder(mediaStream);
      setMediaRecorder(recorder);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          setAudioChunks((chunks) => [...chunks, e.data]);
        }
      };

      recorder.start(250); // Slice data every 250ms
      setRecording(true);
      toast.success("Recording started. Speak in English!");
    } catch (err) {
      toast.error("Mic access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
    toast.success("Recording stopped. Ready to submit!");
  };

  const handleSubmit = async () => {
    if (!challenge) return;
    if (audioChunks.length === 0) {
      toast.error("No recorded audio found.");
      return;
    }

    setSubmitting(true);
    try {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      const formData = new FormData();
      formData.append("file", audioBlob, "challenge_response.wav");

      const res = await challengeApi.complete({
        challengeId: challenge.id,
        audio: formData,
      });

      setResult({
        score: res.score,
        reward: res.reward,
        transcript: (res as any).transcript || "Response received",
        feedback: (res as any).feedback || "Great practice response!",
      });

      toast.success(`Daily Challenge Completed! XP Reward: ${res.reward}`);
      // Refresh today's challenge status and history list
      const today = await challengeApi.today();
      setChallenge(today);
      const hist = await challengeApi.list();
      setHistory(hist);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to submit challenge.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Vani AI Daily Challenge"
        subtitle="Practice random topics, earn rewards, and receive instant AI coach feedback."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !challenge ? (
        <Card className="p-8 text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">No Challenge Available</h3>
          <p className="mt-1 text-sm text-muted-foreground">Come back tomorrow for a new prompt!</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main prompt and practice area */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-primary/20 bg-card shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="border-primary/40 text-primary font-semibold gap-1.5 px-3 py-1">
                    <Target className="h-4 w-4" /> {challenge.type.toUpperCase()}
                  </Badge>
                  {challenge.completed && (
                    <Badge variant="success" className="gap-1.5 px-3 py-1 font-semibold">
                      <Award className="h-4 w-4" /> Challenge Done
                    </Badge>
                  )}
                </div>

                <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight">
                  {challenge.prompt}
                </h2>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="h-10 px-4 text-sm font-mono font-semibold gap-2 border-primary/30">
                    <Clock className="h-4 w-4 text-primary" />
                    {formatTime(time)}
                  </Badge>

                  {challenge.completed ? (
                    <Button variant="outline" disabled className="h-10">
                      Already Completed Today
                    </Button>
                  ) : !recording ? (
                    <Button variant="gradient" onClick={startRecording} className="h-10 glow-peru">
                      <Mic className="h-4 w-4" /> Start Speaking
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopRecording} className="h-10 animate-pulse">
                      <Square className="h-4 w-4" /> Stop Recording
                    </Button>
                  )}

                  {!challenge.completed && (
                    <Button
                      variant="outline"
                      onClick={handleSubmit}
                      disabled={recording || audioChunks.length === 0 || submitting}
                      className="h-10"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Analysing Response...
                        </>
                      ) : (
                        "Submit Challenge"
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Real-time LLM feedback report card */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                >
                  <Card className="border-accent/40 bg-card overflow-hidden shadow-card">
                    <CardHeader className="bg-secondary/20 border-b border-border pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" /> AI Speech Coach Feedback
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border bg-secondary/30 p-4 text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                            Speech Accuracy
                          </p>
                          <p className="mt-1 text-3xl font-extrabold text-primary">{result.score}%</p>
                        </div>
                        <div className="rounded-xl border bg-secondary/30 p-4 text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                            Daily Reward
                          </p>
                          <p className="mt-1 text-lg font-bold text-accent">{result.reward}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 rounded-xl border bg-secondary/30 p-4 text-center flex flex-col justify-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">
                            Status
                          </p>
                          <Badge variant="success" className="mx-auto font-bold px-3 py-1">
                            Success
                          </Badge>
                        </div>
                      </div>

                      {/* Transcribed text block */}
                      <div className="rounded-xl border p-4.5 bg-secondary/20">
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary" /> What you said:
                        </h4>
                        <p className="text-sm text-foreground/90 italic leading-relaxed">
                          "{result.transcript}"
                        </p>
                      </div>

                      {/* LLM Feedback block */}
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
                        <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                          <CheckCircle2 className="h-4.5 w-4.5" /> Coaching Takeaways & Suggestions
                        </h4>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {result.feedback}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right sidebar details */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-primary" /> Daily Challenge History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-xs py-4 text-center text-muted-foreground">
                    No completed challenges in your history. Finish today's challenge to begin!
                  </p>
                ) : (
                  history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg border p-3.5 bg-secondary/10">
                      <div>
                        <p className="text-sm font-semibold truncate max-w-[160px]">{h.title}</p>
                        <p className="text-xs text-muted-foreground">{h.date}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="success" className="font-semibold">
                          Score: {h.score}%
                        </Badge>
                        <p className="mt-1 text-[10px] text-muted-foreground">{h.reward}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
