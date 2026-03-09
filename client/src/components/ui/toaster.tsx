import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

function ToastCountdownBar({ duration = 6000 }: { duration?: number }) {
  const [shrink, setShrink] = React.useState(false)

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShrink(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 !ml-0 h-1 overflow-hidden rounded-b-md bg-foreground/10 group-[.destructive]:bg-destructive-foreground/20">
      <div
        className={cn(
          "h-full origin-left bg-foreground/50 transition-[transform] ease-linear group-[.destructive]:bg-destructive-foreground/70",
          shrink ? "scale-x-0" : "scale-x-100",
        )}
        style={{ transitionDuration: `${duration}ms` }}
      />
    </div>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <ToastCountdownBar duration={duration} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
