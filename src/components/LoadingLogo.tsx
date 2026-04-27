import { cn } from "@/lib/utils";

export function LoadingLogo({ message = "Checking your account…", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-screen items-center justify-center bg-background px-4", className)}>
      <div className="text-center">
        <div className="animate-logo-pulse text-3xl font-extrabold text-primary">HomeAfford</div>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}