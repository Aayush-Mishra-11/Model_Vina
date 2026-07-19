"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Clock,
  Play,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Building2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/dashboard/section-header";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  category: string;
}

const interviewMCQs: Record<string, MCQQuestion[]> = {
  Google: [
    {
      id: "g1",
      question: "Which of the following data structures is typically used to implement a Priority Queue?",
      options: ["Binary Heap", "Linked List", "Hash Table", "Binary Search Tree"],
      answerIndex: 0,
      explanation: "A binary heap provides O(log N) insertion and O(log N) deletion of the priority element, which is optimal for a priority queue.",
      category: "Data Structures"
    },
    {
      id: "g2",
      question: "What is the primary benefit of Google's MapReduce framework?",
      options: ["Real-time transactional processing", "Distributed processing of massive datasets in parallel", "High security database isolation", "Dynamic website rendering"],
      answerIndex: 1,
      explanation: "MapReduce is designed for processing and generating big data sets with a parallel, distributed algorithm on a cluster.",
      category: "Distributed Systems"
    },
    {
      id: "g3",
      question: "Which algorithm is commonly used in Google Search for ranking web pages?",
      options: ["Dijkstra's Algorithm", "PageRank", "Kruskal's Algorithm", "A* Search"],
      answerIndex: 1,
      explanation: "PageRank is an algorithm used by Google Search to rank web pages in their search engine results.",
      category: "Algorithms"
    },
    {
      id: "g4",
      question: "In system design, what does 'Consistent Hashing' help to minimize?",
      options: ["Data latency", "Database locks", "Re-mapping of keys when the number of servers changes", "SQL injection vulnerabilities"],
      answerIndex: 2,
      explanation: "Consistent hashing minimizes the rehashing of keys when servers are added or removed, ensuring high availability in caching layers.",
      category: "System Design"
    },
    {
      id: "g5",
      question: "Which transport protocol is Google's QUIC protocol built on top of?",
      options: ["TCP", "UDP", "SCTP", "HTTP"],
      answerIndex: 1,
      explanation: "QUIC is built on top of UDP to reduce latency compared to TCP, implementing its own connection state and packet loss recovery.",
      category: "Networking"
    }
  ],
  Meta: [
    {
      id: "m1",
      question: "What is the main advantage of React's Virtual DOM?",
      options: ["It connects directly to database servers", "It optimizes DOM manipulation by batching and diffing changes", "It provides CSS styling variables", "It handles server-side databases automatically"],
      answerIndex: 1,
      explanation: "React's Virtual DOM keeps a lightweight copy of the UI and diffs it with the real DOM to perform the minimum necessary updates.",
      category: "Frontend"
    },
    {
      id: "m2",
      question: "In GraphQL, what is the main purpose of using Queries?",
      options: ["To modify server data", "To fetch specific fields of data in a single request", "To open persistent WebSockets", "To compile CSS code"],
      answerIndex: 1,
      explanation: "GraphQL Queries let clients request exactly the data they need and nothing more, reducing over-fetching.",
      category: "API Design"
    },
    {
      id: "m3",
      question: "Which database system was developed by Facebook to handle massive columnar datasets?",
      options: ["Cassandra", "MongoDB", "PostgreSQL", "SQLite"],
      answerIndex: 0,
      explanation: "Apache Cassandra was originally developed at Facebook to power their inbox search feature.",
      category: "Databases"
    },
    {
      id: "m4",
      question: "How does a Content Delivery Network (CDN) speed up asset delivery for users globally?",
      options: ["By encrypting data packets", "By caching files in edge servers closer to the user", "By running server-side SQL queries", "By compressing local CPU memory"],
      answerIndex: 1,
      explanation: "CDNs store static cached copies of files on distributed edge nodes close to geographic locations of users.",
      category: "System Design"
    },
    {
      id: "m5",
      question: "What is the primary role of a 'Load Balancer' in a system like Facebook?",
      options: ["To backup the database", "To distribute incoming network traffic across multiple servers", "To monitor CPU heat sinks", "To compile Javascript code"],
      answerIndex: 1,
      explanation: "A load balancer distributes workload evenly among servers to prevent single nodes from overloading.",
      category: "System Design"
    }
  ],
  Amazon: [
    {
      id: "a1",
      question: "What is the difference between SQL and NoSQL databases?",
      options: ["SQL is relational and uses schemas; NoSQL is non-relational and schema-less", "SQL is slow; NoSQL is always fast", "SQL is only for cloud servers; NoSQL is local", "SQL requires Java; NoSQL requires Python"],
      answerIndex: 0,
      explanation: "SQL databases represent tabular, schema-bound relational tables, while NoSQL databases support dynamic documents, key-values, and graphs.",
      category: "Databases"
    },
    {
      id: "a2",
      question: "In AWS, what is the primary function of Amazon S3?",
      options: ["Running serverless compute functions", "Object storage service for files and backup data", "Relational database server", "Configuring firewall settings"],
      answerIndex: 1,
      explanation: "Simple Storage Service (S3) provides highly durable, scalable, and secure object storage for files.",
      category: "Cloud Computing"
    },
    {
      id: "a3",
      question: "Which design pattern is best suited for notifying multiple client elements when a state changes?",
      options: ["Singleton Pattern", "Observer Pattern", "Factory Pattern", "Adapter Pattern"],
      answerIndex: 1,
      explanation: "The Observer pattern defines a one-to-many dependency so that when one object changes state, all its dependents are notified.",
      category: "Design Patterns"
    },
    {
      id: "a4",
      question: "What does the 'A' in ACID transactions stand for?",
      options: ["Availability", "Atomicity", "Authority", "Algorithms"],
      answerIndex: 1,
      explanation: "Atomicity ensures that all statements in a transaction are either completed successfully or rolled back completely (all-or-nothing).",
      category: "Databases"
    },
    {
      id: "a5",
      question: "What is a major trade-off of using a microservices architecture?",
      options: ["Slower feature development", "Increased operational and network communication complexity", "Harder local testing", "Both B and C"],
      answerIndex: 3,
      explanation: "Microservices introduce distributed tracing, network latency, and deployment complexity that must be managed compared to monoliths.",
      category: "Architecture"
    }
  ],
  Apple: [
    {
      id: "ap1",
      question: "Which programming language is Apple's primary language for iOS and macOS development?",
      options: ["Kotlin", "Swift", "C++", "Objective-Pascal"],
      answerIndex: 1,
      explanation: "Swift is Apple's modern, safe, and fast compiled language used for all Apple platform ecosystems.",
      category: "Programming Languages"
    },
    {
      id: "ap2",
      question: "What is Swift's 'Optional' type used for?",
      options: ["Making arguments optional in functions", "Representing a value that can either exist or be nil", "Declaring dynamic variables", "Running asynchronous tasks"],
      answerIndex: 1,
      explanation: "Swift optionals prevent null pointer exceptions by explicitly wrapping values that might be nil.",
      category: "Swift"
    },
    {
      id: "ap3",
      question: "What is the purpose of 'Automatic Reference Counting' (ARC) on Apple systems?",
      options: ["Tracing web sockets connections", "Managing device battery usage", "Tracking and managing app memory allocation automatically", "Compressing image file sizes"],
      answerIndex: 2,
      explanation: "ARC automatically releases memory used by class instances when they are no longer needed, without manual garbage collection.",
      category: "Memory Management"
    },
    {
      id: "ap4",
      question: "What is the difference between a Struct and a Class in Swift?",
      options: ["Structs are value types; Classes are reference types", "Structs support inheritance; Classes do not", "Structs are stored on the heap; Classes on the stack", "Structs can be nil; Classes cannot"],
      answerIndex: 0,
      explanation: "Structs are copied when passed (value types), whereas Classes pass references (reference types) and support class inheritance.",
      category: "Programming Concepts"
    },
    {
      id: "ap5",
      question: "Which tool is Apple's primary Integrated Development Environment (IDE)?",
      options: ["VS Code", "Xcode", "Android Studio", "IntelliJ IDEA"],
      answerIndex: 1,
      explanation: "Xcode is Apple's developer IDE used to compile and test applications for iOS, macOS, watchOS, and tvOS.",
      category: "Developer Tools"
    }
  ],
  Microsoft: [
    {
      id: "ms1",
      question: "What is the main benefit of TypeScript over JavaScript?",
      options: ["TypeScript executes faster in the browser", "TypeScript adds static typing to help catch errors during development", "TypeScript has built-in database queries", "TypeScript does not need compiling"],
      answerIndex: 1,
      explanation: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript, providing compile-time type checks.",
      category: "Languages"
    },
    {
      id: "ms2",
      question: "What does Active Directory in Windows Server do?",
      options: ["It lists available folders on disk", "It manages users, computers, permissions, and security policies in a network", "It handles SQL Server connections", "It compiles C# projects"],
      answerIndex: 1,
      explanation: "Active Directory is a directory service developed by Microsoft to manage domain networks and assign administrative permissions.",
      category: "System Administration"
    },
    {
      id: "ms3",
      question: "In C#, what is the difference between 'ref' and 'out' parameters?",
      options: ["ref requires variables to be initialized before passing; out does not", "ref is for reference types; out is for value types", "ref is faster; out is secure", "They are identical in C#"],
      answerIndex: 0,
      explanation: "A ref parameter must be initialized before it is passed, whereas an out parameter does not have to be, but must be assigned a value in the method.",
      category: "C#"
    },
    {
      id: "ms4",
      question: "What is the purpose of 'Entity Framework' in .NET core?",
      options: ["Designing frontend interfaces", "An Object-Relational Mapper (ORM) to interact with databases using .NET objects", "Configuring virtual networks in Azure", "Running unit tests"],
      answerIndex: 1,
      explanation: "Entity Framework enables .NET developers to work with a database using domain-specific objects without writing raw SQL queries.",
      category: "Databases"
    },
    {
      id: "ms5",
      question: "Which cloud platform is operated by Microsoft?",
      options: ["AWS", "Google Cloud", "Azure", "Heroku"],
      answerIndex: 2,
      explanation: "Microsoft Azure is a cloud computing service created by Microsoft for building, testing, deploying, and managing applications.",
      category: "Cloud Computing"
    }
  ],
  Netflix: [
    {
      id: "nf1",
      question: "Which microservices testing technique was pioneered by Netflix to ensure high availability?",
      options: ["Unit testing", "Chaos Engineering (Chaos Monkey)", "Integration testing", "Static analysis"],
      answerIndex: 1,
      explanation: "Netflix created Chaos Monkey to randomly disable production instances to test if the remaining system tolerates failures.",
      category: "DevOps / Reliability"
    },
    {
      id: "nf2",
      question: "Why does Netflix use microservices instead of a monolithic architecture?",
      options: ["To make the code run faster", "To enable teams to develop, deploy, and scale service modules independently", "To reduce network traffic costs", "To use single-threaded database engines"],
      answerIndex: 1,
      explanation: "Microservices let Netflix separate streaming recommendation, billing, and encoding layers so failures in one do not bring down the entire app.",
      category: "Architecture"
    },
    {
      id: "nf3",
      question: "What is the primary purpose of Netflix's Zuul edge service?",
      options: ["Video transcoding", "API Gateway for routing, monitoring, and security protection", "Database caching", "User profile storage"],
      answerIndex: 1,
      explanation: "Zuul is an API Gateway that provides dynamic routing, monitoring, resiliency, and security filtering at the edge of Netflix's network.",
      category: "System Design"
    },
    {
      id: "nf4",
      question: "How does Netflix handle global video streaming distribution to reduce ISP traffic?",
      options: ["By sending DVD disks directly", "By deploying physical caching appliances (Open Connect) inside local ISPs", "By using a centralized database in Virginia", "By asking users to download video files"],
      answerIndex: 1,
      explanation: "Netflix Open Connect is their custom CDN that places storage appliances containing movie files inside local internet service providers.",
      category: "Networking"
    },
    {
      id: "nf5",
      question: "What is a circuit breaker pattern in microservices design?",
      options: ["Cutting off power to overloaded servers", "Stopping calls to a failing service to prevent cascading failures", "Encrypting database backups", "Clearing local cache"],
      answerIndex: 1,
      explanation: "A circuit breaker prevents an application from repeatedly trying to execute an operation that's likely to fail, saving thread capacity.",
      category: "Design Patterns"
    }
  ],
  Startup: [
    {
      id: "st1",
      question: "What is the concept of a 'Minimum Viable Product' (MVP)?",
      options: ["An app built with zero code", "A product with just enough features to satisfy early customers and provide feedback", "A cheap copy of an existing app", "An app that is free to download"],
      answerIndex: 1,
      explanation: "An MVP focuses on launching a product with core features to validate market fit quickly and iterate based on user usage.",
      category: "Product Management"
    },
    {
      id: "st2",
      question: "What does 'Product-Market Fit' imply?",
      options: ["Having a website that looks professional", "Being in a market with no competitors", "Creating a product that satisfies a strong market demand", "Securing Venture Capital funding"],
      answerIndex: 2,
      explanation: "Product-Market Fit means the market demands your product and customers are actively buying and using it.",
      category: "Business Strategy"
    },
    {
      id: "st3",
      question: "What is the purpose of Git branches?",
      options: ["To speed up internet downloads", "To allow multiple developers to work on features in isolation without disrupting main code", "To backup hard drives", "To encrypt user passwords"],
      answerIndex: 1,
      explanation: "Git branches create independent lines of development to compile, test, and review features before merging them to the production main branch.",
      category: "Developer Tools"
    },
    {
      id: "st4",
      question: "In agile development, what is a 'Sprint'?",
      options: ["A race between developers to finish features", "A set period of time (e.g. 2 weeks) during which specific work must be completed", "A server compile cycle", "A database query optimization"],
      answerIndex: 1,
      explanation: "Sprints are time-boxed developmental cycles in Scrum to plan, execute, and deliver increments of working software.",
      category: "Agile Methodology"
    },
    {
      id: "st5",
      question: "What is 'Technical Debt' in software development?",
      options: ["The cost of monthly cloud server subscriptions", "The long-term cost of choosing quick, easy code solutions now instead of better designs", "Loans taken from banks to pay developers", "Unused software licenses"],
      answerIndex: 1,
      explanation: "Technical debt is the implied cost of additional rework caused by choosing an easy, short-term solution instead of a clean design.",
      category: "Engineering Management"
    }
  ]
};

const companies = ["Google", "Meta", "Amazon", "Apple", "Microsoft", "Netflix", "Startup"];
const difficulties = ["Easy", "Medium", "Hard"];

export default function InterviewPage() {
  const [selectedCompany, setSelectedCompany] = useState("Google");
  const [selectedDifficulty, setSelectedDifficulty] = useState("Medium");
  const [role, setRole] = useState("Software Engineer");
  
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timer, setTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timer]);

  const startInterview = () => {
    const list = interviewMCQs[selectedCompany] || [];
    if (list.length === 0) {
      toast.error("No questions available for this company.");
      return;
    }
    setQuestions(list);
    setAnswers({});
    setCurrentIndex(0);
    setElapsedSeconds(0);
    setDone(false);
    setStarted(true);

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    setTimer(interval);
    toast.success(`Mock Interview Started: ${selectedCompany}`);
  };

  const handleSelectOption = (optIndex: number) => {
    const currentQ = questions[currentIndex];
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optIndex,
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleFinish = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    
    // Calculate Score
    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.answerIndex) {
        correctCount++;
      }
    });

    setScore(Math.round((correctCount / questions.length) * 100));
    setDone(true);
    toast.success("Interview completed! Calculating score...");
  };

  const formatTime = (total: number) => {
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  const resetInterview = () => {
    setStarted(false);
    setDone(false);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setElapsedSeconds(0);
  };

  if (!started) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Mock Interview" subtitle="Test your knowledge with real-world, company-specific technical multiple-choice questions." />
        <div className="mx-auto max-w-2xl">
          <Card className="overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
            <CardContent className="relative space-y-5 p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase text-muted-foreground">Select Company</label>
                <div className="flex flex-wrap gap-2">
                  {companies.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCompany(c)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150",
                        selectedCompany === c
                          ? "border-primary bg-primary/10 text-primary shadow-glow-sm"
                          : "hover:bg-secondary border-border text-muted-foreground",
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase text-muted-foreground">Select Difficulty</label>
                <div className="flex gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDifficulty(d)}
                      className={cn(
                        "flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all duration-150",
                        selectedDifficulty === d
                          ? "border-primary bg-primary/10 text-primary shadow-glow-sm"
                          : "hover:bg-secondary border-border text-muted-foreground",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase text-muted-foreground">Target Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium focus:border-primary focus:outline-none"
                  placeholder="e.g., Software Engineer"
                />
              </div>

              <Button variant="gradient" className="w-full py-6 text-base" onClick={startInterview}>
                <Play className="mr-2 h-5 w-5" /> Start Written MCQ Interview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Interview Results" subtitle={`Summary of your ${selectedCompany} Written Interview.`} />
        <div className="mx-auto max-w-3xl">
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-success/15 text-success">
                <Trophy className="h-10 w-10 animate-bounce" />
              </div>
              <h2 className="mt-4 font-display text-5xl font-extrabold text-primary">{score}%</h2>
              <p className="text-sm text-muted-foreground">Overall Written MCQ Score</p>
              
              <div className="mt-8 space-y-4 text-left">
                <h3 className="font-display font-semibold text-lg text-foreground">Question Review</h3>
                {questions.map((q, idx) => {
                  const userAns = answers[q.id];
                  const isCorrect = userAns === q.answerIndex;
                  return (
                    <div key={q.id} className="rounded-2xl border border-border bg-secondary/20 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <Badge variant="outline" className="shrink-0">{q.category}</Badge>
                        {isCorrect ? (
                          <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Correct</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Incorrect</Badge>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{idx + 1}. {q.question}</p>
                      
                      <div className="grid gap-2 sm:grid-cols-2 text-xs">
                        {q.options.map((opt, oIdx) => {
                          const isCorrectOpt = oIdx === q.answerIndex;
                          const isUserSelected = oIdx === userAns;
                          return (
                            <div
                              key={opt}
                              className={cn(
                                "flex items-center justify-between rounded-xl border p-2.5",
                                isCorrectOpt
                                  ? "border-success bg-success/10 text-success-foreground font-semibold"
                                  : isUserSelected
                                    ? "border-destructive bg-destructive/10 text-destructive-foreground"
                                    : "border-border bg-background"
                              )}
                            >
                              <span>{opt}</span>
                              {isCorrectOpt && <Check className="h-3.5 w-3.5 text-success" />}
                              {!isCorrectOpt && isUserSelected && <X className="h-3.5 w-3.5 text-destructive" />}
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground border-l-2 border-primary mt-2">
                        <span className="font-semibold text-primary block mb-1">Explanation & Interviewer Tip:</span>
                        {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button variant="gradient" className="w-1/2 py-5" onClick={resetInterview}>
                  Start New Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progressValue = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          title={`${selectedCompany} · Written MCQ Interview`}
          subtitle={`Role: ${role} | Difficulty: ${selectedDifficulty}`}
        />
        <Badge variant="outline" className="gap-1.5 font-mono py-1 px-3">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {formatTime(elapsedSeconds)}
        </Badge>
      </div>

      <Progress value={progressValue} className="h-2" />

      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-secondary/10 flex-row justify-between items-center py-4 px-6">
            <CardTitle className="text-base font-semibold text-foreground">
              Question {currentIndex + 1} of {questions.length}
            </CardTitle>
            <Badge variant="secondary">{currentQ?.category}</Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <h3 className="font-medium text-lg leading-relaxed text-foreground">
              {currentQ?.question}
            </h3>

            <div className="grid gap-3">
              {currentQ?.options.map((opt, oIdx) => {
                const isSelected = answers[currentQ.id] === oIdx;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectOption(oIdx)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-4 text-left text-sm font-medium transition-all duration-150 hover:bg-secondary",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-glow-sm"
                        : "border-border bg-background"
                    )}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          
          {currentIndex < questions.length - 1 ? (
            <Button
              variant="gradient"
              onClick={handleNext}
              disabled={answers[currentQ.id] === undefined}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="gradient"
              onClick={handleFinish}
              disabled={answers[currentQ.id] === undefined}
            >
              Finish & Review Score
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
