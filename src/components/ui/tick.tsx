import { cn } from "@/lib/utils";

/**
 * 老师批改式的对勾：一笔画出来（stroke-dashoffset 动画）。
 * 用在「暂停输入后校验通过」的反馈上，见 ElevatorField 的 adornment。
 */
export function Tick({ className }: { className?: string }) {
  return (
    <span className={cn("tick", className)} aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M4.5 12.8 9.4 17.6 19.5 6.6" />
      </svg>
    </span>
  );
}
