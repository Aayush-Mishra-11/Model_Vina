"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  Award,
  BarChart2,
  CheckCircle2,
  RefreshCw,
  Flame,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/dashboard/section-header";
import { VoiceWave } from "@/components/voice-wave";
import { useApi } from "@/hooks/use-api";
import { partnerApi, type PartnerSessionSummary } from "@/api/partner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ChatMessage } from "@/lib/types";

const suggestedPrompts = [
  "Let's talk about travel experiences",
  "Help me practice a job interview introduction",
  "Discuss technology and AI trends",
  "Talk about movies and hobbies",
];

export default function PartnerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [languageAlertWords, setLanguageAlertWords] = useState<string[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState<"easy" | "medium" | "hard">("easy");
  const [difficultyLabel, setDifficultyLabel] = useState<string>("🌱 Easy (Warm-up)");
  const [turnCount, setTurnCount] = useState<number>(0);

  // Summary modal state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<PartnerSessionSummary | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const { data: topics } = useApi(["partner-topics"], partnerApi.getTopics);
  const { data: history } = useApi(["partner-history"], () => partnerApi.getHistory());

  // Load history
  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, isSpeaking]);

  // Load SpeechSynthesis voices for AI Voice Agent
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const englishVoices = available.filter((v) => v.lang.startsWith("en"));
      setVoices(englishVoices.length ? englishVoices : available);
      if (englishVoices.length && !selectedVoice) {
        const pref = englishVoices.find((v) => v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Zira") || v.name.includes("Samantha")) || englishVoices[0];
        setSelectedVoice(pref.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  // Speech Recognition (STT) setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setInput(transcript);

      if (event.results[0].isFinal) {
        setIsListening(false);
        send(transcript);
      }
    };

    recog.onerror = (err: any) => {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    };

    recog.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recog;
  }, []);

  // AI Voice Agent Speech Synthesis (TTS)
  const speakReply = (text: string) => {
    if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel(); // Stop current speech
    const cleanText = text.replace(/💡[\s\S]*$/, "").trim(); // Remove raw emoji tip suffix for spoken audio
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (selectedVoice) {
      const vObj = voices.find((v) => v.name === selectedVoice);
      if (vObj) utterance.voice = vObj;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput("");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        toast("Listening... Speak in English!", { icon: "🎙️" });
      } catch (err) {
        toast.error("Microphone access failed. You can type your response!");
      }
    }
  };

  const send = async (text: string) => {
    const value = text.trim();
    if (!value) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: value,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await partnerApi.sendMessage({ message: value });
      setTyping(false);
      setMessages((m) => [...m, res]);

      // Handle progressive difficulty transition
      if (res.difficultyLevel && res.difficultyLevel !== difficultyLevel) {
        const icon = res.difficultyLevel === "medium" ? "🚀" : "🔥";
        toast(`Level Up! ${res.difficultyLabel}`, { icon, duration: 4000 });
      }
      if (res.difficultyLevel) setDifficultyLevel(res.difficultyLevel);
      if (res.difficultyLabel) setDifficultyLabel(res.difficultyLabel);
      if (res.turnCount) setTurnCount(res.turnCount);

      // Check non-English warning
      if (res.languageAlert) {
        const words = res.detectedNonEnglishWords?.join(", ") || "Non-English";
        setLanguageAlertWords(res.detectedNonEnglishWords || ["Hindi/Non-English"]);
        toast.error(`⚠️ Language Warning: Non-English words detected (${words}). Please speak strictly in English!`, {
          duration: 5000,
        });
      } else {
        setLanguageAlertWords([]);
      }

      // Voice playback
      speakReply(res.content);
    } catch (err) {
      setTyping(false);
      toast.error(err instanceof Error ? err.message : "Message failed");
    }
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    try {
      const summary = await partnerApi.stopSession();
      setSummaryData(summary);
      setSummaryOpen(true);
    } catch (err) {
      toast.error("Failed to generate session feedback.");
    } finally {
      setEndingSession(false);
    }
  };

  const handleStartNewSession = async () => {
    setSummaryOpen(false);
    try {
      const res = await partnerApi.resetSession();
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: res.greeting,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDifficultyLevel("easy");
      setDifficultyLabel("🌱 Easy (Warm-up)");
      setTurnCount(0);
      setLanguageAlertWords([]);
      toast.success("New practice session started!");
    } catch (err) {
      toast.error("Failed to reset session.");
    }
  };


  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Top Header */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Vani AI Voice Partner"
          subtitle="Real-time voice agent with progressive difficulty (Easy → Medium → Hard) & live speech."
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty badge */}
          <Badge
            variant={
              difficultyLevel === "easy"
                ? "success"
                : difficultyLevel === "medium"
                  ? "secondary"
                  : "destructive"
            }
            className="px-3 py-1.5 text-xs font-semibold shadow-sm"
          >
            {difficultyLabel}
          </Badge>

          {/* Voice select */}
          {voices.length > 0 && (
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}

          {/* Mute button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMuted(!muted);
              if (!muted && typeof window !== "undefined") window.speechSynthesis.cancel();
            }}
          >
            {muted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4 text-primary" />}
            {muted ? "Muted" : "Voice On"}
          </Button>

          {/* End Session Button */}
          <Button variant="gradient" size="sm" onClick={handleEndSession} loading={endingSession}>
            <BarChart2 className="h-4 w-4" /> End Session & Feedback
          </Button>
        </div>
      </div>

      {/* Language Warning Banner */}
      {languageAlertWords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-warning-foreground shadow-sm"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1">
            <span className="font-semibold">Language Alert:</span> Non-English words detected (
            <span className="font-mono">{languageAlertWords.join(", ")}</span>). Please speak 100% in English to build fluency!
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLanguageAlertWords([])} className="h-7 px-2 text-xs">
            Dismiss
          </Button>
        </motion.div>
      )}

      {/* Chat Area & Sidebar */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Topics Sidebar */}
        <Card className="hidden w-64 shrink-0 flex-col p-4 md:flex">
          <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Conversation Topics
          </h3>
          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
            {topics?.length ? (
              topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => send(`Let's talk about ${t.label.toLowerCase()}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <span className="text-lg">{t.emoji}</span> {t.label}
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Loading topics…</p>
            )}
          </div>
        </Card>

        {/* Main Chat Box */}
        <Card className="flex flex-1 flex-col overflow-hidden">
          {/* AI Voice Avatar Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 bg-vani-gradient text-white glow-peru">
                  <AvatarFallback className="bg-transparent text-white font-bold">V</AvatarFallback>
                </Avatar>
                {isSpeaking && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success">
                    <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  Vani AI {isSpeaking && <Badge variant="success">Speaking...</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">English Communication Partner</p>
              </div>
            </div>

            {/* Live voice wave animation */}
            <div className="h-8 w-32">
              <VoiceWave active={isSpeaking || isListening} bars={12} />
            </div>
          </div>

          {/* Messages Container */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-5">
            {messages.length === 0 && !typing && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-vani-gradient text-white glow-peru mb-2">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="mt-2 font-display text-xl font-bold">Start Practice with Vani AI</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Tap the mic to speak in English or select a prompt below.
                </p>
                <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((p) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="cursor-pointer px-3 py-1.5 hover:bg-primary/10 transition-colors"
                      onClick={() => send(p)}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {m.role === "assistant" ? (
                    <Avatar className="h-9 w-9 bg-premium-gradient text-white">
                      <AvatarFallback className="bg-transparent text-white font-bold">AI</AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="h-9 w-9 bg-secondary">
                      <AvatarFallback className="text-xs font-semibold">YOU</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-1 max-w-[75%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && (
                      <button
                        onClick={() => speakReply(m.content)}
                        className="self-start text-[10px] font-medium text-muted-foreground hover:text-primary flex items-center gap-1 px-1 py-0.5"
                      >
                        <Volume2 className="h-3 w-3" /> Replay voice
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {typing && (
              <div className="flex gap-3">
                <Avatar className="h-9 w-9 bg-premium-gradient text-white">
                  <AvatarFallback className="bg-transparent text-white">AI</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1.5 rounded-2xl bg-secondary px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-2 w-2 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="border-t border-border p-4 bg-card/40">
            <div className="flex items-center gap-2">
              {/* Mic STT button */}
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={toggleListening}
                className={cn("shrink-0 transition-transform active:scale-95", isListening && "animate-pulse")}
                title={isListening ? "Stop listening" : "Start speaking"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-primary" />}
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder={isListening ? "Listening... Speak now..." : "Type or speak in English..."}
                className="flex-1"
              />

              <Button variant="gradient" size="icon" onClick={() => send(input)} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Session Feedback & Analysis Modal */}
      {summaryData && (
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Award className="h-6 w-6 text-primary" /> Session Performance Feedback
              </DialogTitle>
              <DialogDescription>
                Detailed coaching analysis of your speaking partner conversation session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Score Badges Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Overall Score</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{summaryData.score}%</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Fluency Score</p>
                  <p className="mt-1 text-2xl font-bold text-accent">{summaryData.fluencyScore}%</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Fillers Used</p>
                  <p className="mt-1 text-2xl font-bold text-warning">{summaryData.fillerCount}</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Language Alerts</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">{summaryData.languageAlertsCount}</p>
                </div>
              </div>

              {/* Fillers Breakdown */}
              {summaryData.fillerCount > 0 && (
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-warning" /> Filler Words Used
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summaryData.fillerBreakdown).map(([word, cnt]) => (
                      <Badge key={word} variant="secondary" className="px-3 py-1 text-xs">
                        "{word}": {cnt} time{cnt > 1 ? "s" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Grammar & Phrasing Corrections */}
              {summaryData.grammarErrors.length > 0 && (
                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" /> Grammar & Expression Fixes
                  </h4>
                  <div className="space-y-2">
                    {summaryData.grammarErrors.map((g, idx) => (
                      <div key={idx} className="rounded-lg bg-secondary/50 p-2.5 text-xs space-y-1">
                        <p className="text-muted-foreground">Original: "{g.original}"</p>
                        <p className="font-medium text-foreground">💡 Tip: {g.tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Tips */}
              <div className="rounded-xl border bg-primary/5 p-4 border-primary/20 space-y-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Actionable Coaching Takeaways
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90">
                  {summaryData.coachingTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="gradient" onClick={handleStartNewSession}>
                Done & Start New Practice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
