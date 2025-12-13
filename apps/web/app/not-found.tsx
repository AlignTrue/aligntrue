import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/PageLayout";

export default function NotFoundPage() {
  return (
    <PageLayout mainClassName="pb-20">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center opacity-70">
          <div className="h-40 w-[720px] bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16 text-center flex flex-col items-center gap-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary/70" aria-hidden />
            404 - Page not found
          </span>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
              Lost the trail?
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has moved.
              Go back to the homepage below.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to homepage
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
