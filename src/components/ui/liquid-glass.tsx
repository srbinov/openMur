import * as React from "react";
import { cn } from "../lib/utils";

const GLASS_EASE = "cubic-bezier(0.175, 0.885, 0.32, 2.2)";

export type GlassTint = "default" | "accent" | "listening" | "success";
/** window = full app shell; pane = sidebar/content regions; surface = cards & controls */
export type GlassDensity = "window" | "pane" | "surface";

export interface GlassEffectProps extends React.HTMLAttributes<HTMLDivElement> {
  href?: string;
  target?: string;
  interactive?: boolean;
  rounded?: string;
  tint?: GlassTint;
  density?: GlassDensity;
}

type DensityStyle = {
  blur: string;
  saturate: number;
  distortOpacity: number;
  specular: string;
  border: string;
  shadow: string;
  highlight: string;
  tintLayers: string[];
};

const densityStyles: Record<GlassDensity, DensityStyle> = {
  window: {
    blur: "blur(64px)",
    saturate: 2.25,
    distortOpacity: 0.2,
    specular: "from-white/35 via-white/10 to-transparent dark:from-white/22 dark:via-white/5",
    border: "border border-white/40 dark:border-white/25",
    shadow:
      "shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.4)]",
    highlight:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_0_100px_rgba(136,158,255,0.04)]",
    tintLayers: ["bg-white/6 dark:bg-white/4", "bg-black/8 dark:bg-black/14"],
  },
  pane: {
    blur: "blur(28px)",
    saturate: 1.85,
    distortOpacity: 0.14,
    specular: "from-white/18 to-transparent dark:from-white/8",
    border: "border border-white/18 dark:border-white/12",
    shadow: "shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]",
    highlight:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.32),inset_2px_2px_1px_0_rgba(255,255,255,0.08)]",
    tintLayers: ["bg-white/8 dark:bg-white/5", "bg-black/5 dark:bg-black/10"],
  },
  surface: {
    blur: "blur(20px)",
    saturate: 1.7,
    distortOpacity: 0.15,
    specular: "from-white/25 to-transparent dark:from-white/12",
    border: "border border-white/30 dark:border-white/16",
    shadow: "shadow-[0_6px_24px_rgba(0,0,0,0.14),0_0_0_1px_rgba(255,255,255,0.06)]",
    highlight:
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),inset_2px_2px_1px_0_rgba(255,255,255,0.15)]",
    tintLayers: ["bg-white/18 dark:bg-white/9"],
  },
};

const tintOverrides: Partial<
  Record<GlassTint, Partial<Pick<DensityStyle, "tintLayers" | "border" | "shadow">>>
> = {
  accent: {
    tintLayers: ["bg-primary/22 dark:bg-primary/18", "bg-black/10 dark:bg-black/16"],
    border: "border border-primary/35 dark:border-primary/28",
    shadow: "shadow-[0_12px_40px_rgba(99,102,241,0.28),0_0_20px_rgba(99,102,241,0.12)]",
  },
  listening: {
    tintLayers: ["bg-[#889eff]/75 dark:bg-[#889eff]/65"],
    border: "border border-[#c4ceff]/55",
    shadow: "shadow-[0_12px_44px_rgba(136,158,255,0.5),0_0_28px_rgba(136,158,255,0.28)]",
  },
  success: {
    tintLayers: ["bg-emerald-400/18 dark:bg-emerald-500/14", "bg-black/8"],
    border: "border border-emerald-400/30",
    shadow: "shadow-[0_10px_32px_rgba(16,185,129,0.22)]",
  },
};

export const GlassEffect = React.forwardRef<HTMLDivElement, GlassEffectProps>(
  (
    {
      children,
      className = "",
      style = {},
      href,
      target = "_blank",
      interactive = true,
      rounded = "rounded-2xl",
      tint = "default",
      density = "surface",
      ...props
    },
    ref
  ) => {
    const base = densityStyles[density];
    const override = tint !== "default" ? tintOverrides[tint] : undefined;
    const layers = override?.tintLayers ?? base.tintLayers;
    const border = override?.border ?? base.border;
    const shadow = override?.shadow ?? base.shadow;

    const glassStyle: React.CSSProperties = {
      transitionTimingFunction: GLASS_EASE,
      ...style,
    };

    const content = (
      <div
        ref={ref}
        className={cn(
          "liquid-glass-surface relative flex overflow-hidden text-foreground",
          rounded,
          border,
          shadow,
          density === "window" && "liquid-glass-window",
          interactive && "cursor-pointer transition-all duration-500 hover:brightness-[1.03]",
          className
        )}
        style={glassStyle}
        {...props}
      >
        <div
          className={cn("absolute inset-0 z-0 overflow-hidden", rounded)}
          style={{
            backdropFilter: `${base.blur} saturate(${base.saturate})`,
            WebkitBackdropFilter: `${base.blur} saturate(${base.saturate})`,
          }}
          aria-hidden
        />
        <div
          className={cn("absolute inset-0 z-[1] overflow-hidden liquid-glass-distort", rounded)}
          style={{ opacity: base.distortOpacity }}
          aria-hidden
        />
        {layers.map((layer, i) => (
          <div
            key={i}
            className={cn("absolute inset-0", rounded, layer)}
            style={{ zIndex: 10 + i }}
            aria-hidden
          />
        ))}
        <div
          className={cn(
            "absolute inset-0 z-20 overflow-hidden pointer-events-none",
            rounded,
            base.highlight
          )}
          aria-hidden
        />
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-[25] h-[45%] pointer-events-none bg-gradient-to-b",
            rounded,
            base.specular
          )}
          aria-hidden
        />
        {density === "window" && (
          <div
            className="pointer-events-none absolute inset-0 z-[8] opacity-[0.4] dark:opacity-[0.28]"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 85% 55% at 12% 0%, rgba(136,158,255,0.22), transparent 52%), radial-gradient(ellipse 70% 50% at 92% 100%, rgba(99,102,241,0.16), transparent 48%)",
              animation: "liquid-glass-shimmer 12s ease-in-out infinite",
            }}
          />
        )}
        <div className="relative z-30 min-w-0 flex-1">{children}</div>
      </div>
    );

    if (href) {
      return (
        <a href={href} target={target} rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    }

    return content;
  }
);
GlassEffect.displayName = "GlassEffect";

/** Full-window translucent shell — desktop wallpaper bleeds through the blur. */
export const GlassWindow = React.forwardRef<HTMLDivElement, GlassEffectProps>(
  ({ className, rounded = "rounded-[18px]", interactive = false, density = "window", ...props }, ref) => (
    <GlassEffect
      ref={ref}
      density={density}
      interactive={interactive}
      rounded={rounded}
      className={cn("h-full w-full flex flex-col", className)}
      {...props}
    />
  )
);
GlassWindow.displayName = "GlassWindow";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tint?: GlassTint;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ children, className, tint = "default", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("border-0 bg-transparent p-0 text-left", className)}
      {...props}
    >
      <GlassEffect
        tint={tint}
        density="surface"
        rounded="rounded-2xl"
        className="px-5 py-2.5 font-medium hover:px-6 hover:py-3"
      >
        <span
          className="inline-flex transition-transform duration-500 hover:scale-[0.98]"
          style={{ transitionTimingFunction: GLASS_EASE }}
        >
          {children}
        </span>
      </GlassEffect>
    </button>
  )
);
GlassButton.displayName = "GlassButton";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tint?: GlassTint;
  density?: GlassDensity;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className, tint = "default", density = "pane", ...props }, ref) => (
    <GlassEffect
      ref={ref}
      tint={tint}
      density={density}
      interactive={false}
      rounded="rounded-2xl"
      className={cn("h-full w-full flex flex-col", className)}
      {...props}
    >
      {children}
    </GlassEffect>
  )
);
GlassPanel.displayName = "GlassPanel";

/** Mount once at app root — provides the SVG displacement filter for all glass surfaces. */
export const GlassFilter: React.FC = () => (
  <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="100"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);
