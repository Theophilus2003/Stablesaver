/** Brand-green glow and a faint dot grid behind each page's hero. Decorative only. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[860px] overflow-hidden">
      <div className="absolute left-1/2 top-[-220px] h-[680px] w-[1200px] max-w-[220vw] -translate-x-1/2">
        <div className="size-full animate-glow rounded-full bg-[radial-gradient(closest-side,rgb(61_220_151/0.22),transparent)]" />
      </div>
      <div className="absolute left-[62%] top-[160px] h-[460px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(56_189_248/0.08),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,#000_25%,transparent_75%)]" />
    </div>
  );
}
