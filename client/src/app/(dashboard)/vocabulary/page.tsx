"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Bookmark,
  BookmarkPlus,
  Shuffle,
  Check,
  X,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/dashboard/section-header";
import { vocabularyApi } from "@/api/vocabulary";
import { Counter } from "@/components/counter";
import toast from "react-hot-toast";
import type { VocabularyWord } from "@/lib/types";

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

function generateQuiz(words: VocabularyWord[], numQuestions = 5): QuizQuestion[] {
  if (words.length < 4) return [];
  const quizQuestions: QuizQuestion[] = [];
  
  const shuffledTargets = [...words].sort(() => 0.5 - Math.random());
  const selectedTargets = shuffledTargets.slice(0, Math.min(numQuestions, words.length));

  for (const target of selectedTargets) {
    const correctMeaning = target.meaning;
    const otherMeanings = words
      .filter((w) => w.id !== target.id)
      .map((w) => w.meaning);
    const shuffledOthers = otherMeanings.sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3);
    
    const options = [correctMeaning, ...distractors].sort(() => 0.5 - Math.random());
    const answerIndex = options.indexOf(correctMeaning);
    
    quizQuestions.push({
      q: `What is the meaning of "${target.word}"?`,
      options,
      answer: answerIndex,
    });
  }
  return quizQuestions;
}

export default function VocabularyPage() {
  const [wordOfDay, setWordOfDay] = useState<VocabularyWord | null>(null);
  const [deck, setDeck] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  
  const [quizList, setQuizList] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizState, setQuizState] = useState<{ selected: number | null; done: boolean }>({
    selected: null,
    done: false,
  });
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Load Word of the Day
    vocabularyApi.wordOfDay()
      .then((w) => setWordOfDay(w))
      .catch(() => {});

    // Load Vocabulary Words
    vocabularyApi.list(50)
      .then((words) => {
        if (words && words.length > 0) {
          setDeck(words);
          setQuizList(generateQuiz(words, 5));
        }
      })
      .catch((err) => {
        toast.error("Failed to load vocabulary words.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const current = deck[index];

  const toggleBookmark = async (id: string) => {
    try {
      const res = await vocabularyApi.toggleBookmark(id);
      setDeck((d) => d.map((w) => (w.id === id ? { ...w, bookmarked: res.bookmarked } : w)));
      toast.success(res.bookmarked ? "Bookmarked!" : "Bookmark removed");
    } catch {
      toast.error("Failed to update bookmark");
    }
  };

  const nextCard = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % deck.length);
  };

  const answerQuiz = (i: number) => {
    if (quizState.selected !== null) return;
    setQuizState((s) => ({ ...s, selected: i }));
    const currentQ = quizList[quizIndex];
    if (i === currentQ.answer) setScore((s) => s + 1);
  };

  const nextQuizQuestion = () => {
    setQuizState((s) => ({ ...s, selected: null }));
    if (quizIndex < quizList.length - 1) {
      setQuizIndex((idx) => idx + 1);
    } else {
      setQuizState((s) => ({ ...s, done: true }));
    }
  };

  const handleRetryQuiz = () => {
    setScore(0);
    setQuizIndex(0);
    setQuizState({ selected: null, done: false });
    setQuizList(generateQuiz(deck, 5));
  };

  const playPronunciation = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    } else {
      toast.success(`Pronunciation of ${word}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 mt-4 text-sm text-muted-foreground">Loading vocabulary...</span>
      </div>
    );
  }

  if (deck.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Vocabulary Builder" subtitle="Learn a word a day. Practice with flashcards and quizzes." />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No vocabulary words found. Please check that the server is active.
        </Card>
      </div>
    );
  }

  const currentQ = quizList[quizIndex];

  return (
    <div className="space-y-6">
      <SectionHeader title="Vocabulary Builder" subtitle="Learn a word a day. Practice with flashcards and quizzes." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Word of the day */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
          <CardContent className="relative p-6">
            <div className="flex items-center gap-2">
              <Badge variant="gradient" className="bg-primary/15 text-primary">Word of the day</Badge>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-3xl font-bold">{wordOfDay?.word ?? "Eloquent"}</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => playPronunciation(wordOfDay?.word ?? "Eloquent")}>
                  <Volume2 className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{wordOfDay?.phonetic ?? "/ˈeləkwənt/"}</span>
              </div>
              <p className="mt-3 text-muted-foreground">
                {wordOfDay?.meaning ?? "Fluent and persuasive in speaking or writing."}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Synonyms</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(wordOfDay?.synonyms ?? ["articulate", "expressive"]).map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Antonyms</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(wordOfDay?.antonyms ?? ["inarticulate"]).map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Example</p>
                  <p className="mt-1.5 text-sm">“{(wordOfDay?.examples ?? ["She gave an eloquent speech."])[0]}”</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="font-display font-semibold">Your progress</h3>
            <div className="rounded-xl bg-primary/5 p-4 text-center">
              <p className="font-display text-4xl font-bold text-primary">
                <Counter to={deck.length} />
              </p>
              <p className="text-xs text-muted-foreground">words available</p>
            </div>
            <div className="rounded-xl bg-success/5 p-4 text-center">
              <p className="font-display text-4xl font-bold text-success">
                <Counter to={14} />
              </p>
              <p className="text-xs text-muted-foreground">day streak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flashcards */}
      <div>
        <SectionHeader title="Flashcards" subtitle="Tap to flip. Swipe through your deck." />
        <div className="flex flex-col items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, rotateY: -10, y: 10 }}
              animate={{ opacity: 1, rotateY: 0, y: 0 }}
              exit={{ opacity: 0, rotateY: 10, y: -10 }}
              transition={{ duration: 0.3 }}
              onClick={() => setFlipped((f) => !f)}
              className="relative flex h-56 w-full max-w-md cursor-pointer items-center justify-center rounded-3xl border bg-premium-gradient p-8 text-center text-white shadow-glow"
            >
              {!flipped ? (
                <div>
                  <p className="font-display text-4xl font-bold">{current.word}</p>
                  <p className="mt-2 text-white/80">{current.phonetic}</p>
                  <p className="mt-4 text-xs text-white/60">Click card to reveal meaning</p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-medium">{current.meaning}</p>
                  {current.examples && current.examples.length > 0 && (
                    <p className="mt-3 text-sm text-white/80 italic">
                      “{current.examples[0]}”
                    </p>
                  )}
                  <p className="mt-4 text-xs text-white/60">Click card to show word</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => toggleBookmark(current.id)}>
              {current.bookmarked ? <Bookmark className="h-4 w-4 text-primary" fill="currentColor" /> : <BookmarkPlus className="h-4 w-4" />}
            </Button>
            <Button variant="gradient" onClick={nextCard}>
              <Shuffle className="h-4 w-4" /> Next card
            </Button>
          </div>
        </div>
      </div>

      {/* Quiz */}
      {currentQ && (
        <div>
          <SectionHeader title="Quick quiz" subtitle="Test what you remember." />
          <Card>
            <CardContent className="space-y-4 p-6">
              {!quizState.done ? (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Question {quizIndex + 1} of {quizList.length}</span>
                    <span>Current Score: {score}</span>
                  </div>
                  <p className="font-medium">{currentQ.q}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {currentQ.options.map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => answerQuiz(i)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors hover:bg-secondary ${
                          quizState.selected === i
                            ? i === currentQ.answer
                              ? "border-success bg-success/10"
                              : "border-destructive bg-destructive/10"
                            : quizState.selected !== null && i === currentQ.answer
                              ? "border-success bg-success/10" // Highlight correct answer on fail
                              : ""
                        }`}
                      >
                        <span className="flex-1 pr-2">{opt}</span>
                        {quizState.selected !== null && i === currentQ.answer && <Check className="h-4 w-4 text-success shrink-0" />}
                        {quizState.selected === i && i !== currentQ.answer && <X className="h-4 w-4 text-destructive shrink-0" />}
                      </button>
                    ))}
                  </div>
                  {quizState.selected !== null && (
                    <Button
                      variant="gradient"
                      onClick={nextQuizQuestion}
                    >
                      {quizIndex < quizList.length - 1 ? "Next question" : "See result"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">
                    <Counter to={score} /> / {quizList.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {score === quizList.length ? "Perfect! 🎉" : "Keep practicing!"}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleRetryQuiz}>
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
