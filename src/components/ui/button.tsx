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
  // Base — affordance: parece clicável, responde ao toque
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-ui rounded-lg text-sm font-semibold",
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Micro-interação no clique (conceito 10)
    "active:scale-[0.97]",
    "select-none cursor-pointer",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — destaque máximo com sombra colorida
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-primary",

        // Destructive — vermelho semântico
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90",

        // Outline — borda sutil, fundo branco (affordance clara de "botão secundário")
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-muted hover:border-border/80",

        // Secondary — superfície muted
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",

        // Ghost — transparente, mas com hover visível
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",

        // Link — affordance de texto clicável
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
      },
      size: {
        // Padding baseado em múltiplos de 8pt (conceito 8 e 3)
        default: "h-10 px-5 py-2",   // 40px h, 20px lateral
        sm:      "h-9 px-4 py-1.5 text-xs rounded-md",  // 36px
        lg:      "h-11 px-8 py-2.5 text-base rounded-xl", // 44px
        icon:    "h-10 w-10 p-0",
        "icon-sm":"h-8 w-8 p-0 rounded-md",
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
