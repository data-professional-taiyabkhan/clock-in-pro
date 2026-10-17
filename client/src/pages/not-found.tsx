import { Link } from "wouter";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="glow-bg flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo size="lg" />
      <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">That link doesn't go anywhere. If an admin sent you an organisation link, check it was copied in full.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
