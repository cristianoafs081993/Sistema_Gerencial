import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — Conceitos aplicados do vídeo:
 * 1. Affordances & Signifiers: cursor-pointer, shadow, ring on focus
 * 4. Tipografia: font-medium / font-semibold adequados
 * 8. Icons & Buttons: padding correto (py=8px, px=16–32px)
 * 9. Feedback & States: hover, active (scale), focus-visible, disabled
 * 10. Micro-interações: transition suave, active:scale-[0.97]
 */
const buttonVariants = cva(
  // Base SUAP button styling — estilo pill arredondado e toque acessível
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-ui rounded-full text-sm font-semibold",
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-95",
    "select-none cursor-pointer",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary SUAP — sólido na cor primária institucional com hover contrastado
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-primary",

        // Destructive SUAP — vermelho semântico
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",

        // Outline — borda de 1px, fundo branco/card, texto primário ou preto
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-muted hover:border-primary/40",

        // Secondary — superfície suave
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",

        // Ghost — fundo transparente com hover suave
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",

        // Link — texto clicável no tom primário do SUAP
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",

        // SUAP Pill oficial
        suap:
          "bg-primary text-primary-foreground rounded-full hover:bg-primary/90 shadow-sm",

        // Brand — cor de destaque
        brand:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",

        // Gold / Alerta
        gold:
          "bg-warning text-foreground hover:opacity-90 shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",        // 36px altura padrão SUAP
        sm:      "h-8 px-3 py-1 text-xs",        // 32px altura compacta SUAP
        lg:      "h-10 px-6 py-2.5 text-base",   // 40px altura ampla
        icon:    "h-9 w-9 p-0 rounded-full",
        "icon-sm":"h-7 w-7 p-0 rounded-full text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
