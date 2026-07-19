import { apiClient } from "@/lib/axios";
import type {
  InterviewConfig,
  InterviewQuestion,
  InterviewFeedback,
  InterviewSummary,
} from "@/lib/types";

/**
 * Mock Interview API.
 *  POST   /interview/start
 *  GET    /interview/questions
 *  POST   /interview/answer
 *  POST   /interview/feedback
 *  GET    /interview/summary/:id
 */

export const interviewApi = {
  start: (payload: InterviewConfig) =>
    apiClient.post<{ interviewId: string }>("/api/interview/start", payload).then((r) => r.data),

  getQuestions: (interviewId: string) =>
    apiClient
      .get<InterviewQuestion[]>(`/api/interview/questions?interviewId=${interviewId}`)
      .then((r) => r.data),

  submitAnswer: (payload: { interviewId: string; questionId: string; audio: FormData }) =>
    apiClient
      .post<InterviewFeedback>("/api/interview/answer", payload.audio, {
        params: { interviewId: payload.interviewId, questionId: payload.questionId },
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  getSummary: (interviewId: string) =>
    apiClient
      .get<InterviewSummary>(`/api/interview/summary/${interviewId}`)
      .then((r) => r.data),
};

export type { InterviewConfig, InterviewQuestion, InterviewFeedback, InterviewSummary };
