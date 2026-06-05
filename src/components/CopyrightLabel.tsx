import { Github } from "lucide-react";

import { cn } from "@/lib/utils";

export function CopyrightLabel({ className }: { className?: string }) {
  return (
    <a
      href="https://github.com/Stacer-Varien"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <Github className="h-3.5 w-3.5" />
      <span>© 2026 Stacer Varien</span>
    </a>
  );
}
