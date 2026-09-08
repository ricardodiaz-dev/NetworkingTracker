"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Card, Spinner } from "@/components/ui/misc";
import { neon } from "@/lib/neon/browser";
import { useSession } from "@/lib/use-session";

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const router = useRouter();
  const { session } = useSession();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session.status === "signed-in") router.replace("/contacts");
  }, [session.status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "sign-up" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "sign-in"
          ? await neon.auth.signIn.email({ email, password })
          : await neon.auth.signUp.email({ email, password, name: name || email });

      if (result?.error) {
        setError(result.error.message ?? "That did not work. Please try again.");
        return;
      }

      router.replace("/contacts");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That did not work. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (session.status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Welcome back to your networking tracker."
            : "Start tracking the people you meet at Berkeley."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "sign-up" && (
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Oski Bear"
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@berkeley.edu"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-4"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            {mode === "sign-in" ? "Create one" : "Sign in"}
          </button>
        </p>
      </Card>
    </main>
  );
}
