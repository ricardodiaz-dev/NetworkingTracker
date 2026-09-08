import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Networking Tracker
        </h1>
        <p className="text-muted-foreground">
          Keep track of the people you want to stay connected with at Berkeley —
          who they are, where you met, and who to follow up with first. Every
          contact list is private to the account that created it.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/sign-in">
          <Button className="w-full sm:w-auto">Sign in</Button>
        </Link>
        <Link href="/contacts">
          <Button variant="outline" className="w-full sm:w-auto">
            Go to my contacts
          </Button>
        </Link>
      </div>
    </main>
  );
}
