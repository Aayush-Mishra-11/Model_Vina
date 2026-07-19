"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth-store";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const setAuth = useAuthStore((s) => s.setAuth);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    authApi
      .verify(token)
      .then((res) => {
        setAuth(res.user, res.token);
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 1400);
      })
      .catch(() => setStatus("error"));
  }, [token, router, setAuth]);

  return (
    <AuthShell
      title="Verifying your email"
      subtitle="Please wait while we confirm your account."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      <div className="flex flex-col items-center justify-center py-8 text-center">
        {status === "loading" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Confirming your email address…</p>
          </motion.div>
        )}
        {status === "success" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <p className="mt-4 font-medium">Email verified!</p>
            <p className="mt-1 text-sm text-muted-foreground">Taking you to your dashboard…</p>
          </motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <XCircle className="h-9 w-9" />
            </div>
            <p className="mt-4 font-medium">Verification failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The link may be expired or invalid.
            </p>
            <Button variant="outline" className="mt-5" asChild>
              <Link href="/signup">Create a new account</Link>
            </Button>
          </motion.div>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <MailCheck className="h-8 w-8 animate-pulse text-primary" />
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
