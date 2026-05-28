export default function Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body p-[6vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 01</span>
        <span>The Problem</span>
        <span>02 / 10</span>
      </div>

      <div className="grid grid-cols-12 gap-[3vw] h-full pt-[12vh] pb-[10vh]">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="text-muted text-[1.5vw] uppercase tracking-[0.3em] mb-[3vh]">
            Today&apos;s AI memory
          </div>
          <h2 className="font-display font-bold text-[5.2vw] leading-[0.95] tracking-tight text-balance">
            We store meaning as
            <span className="block text-warm">long lists of numbers.</span>
          </h2>
          <p className="mt-[4vh] text-[1.8vw] leading-relaxed text-text/85 max-w-[40vw] text-pretty">
            Every memory becomes a 1,500-dimension vector.
            Every search compares it against millions of others.
            The bill, and the latency, scale with the math.
          </p>
        </div>

        <div className="col-span-5 flex flex-col justify-center border-l border-border pl-[3vw]">
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            Per memory
          </div>
          <div className="font-display font-bold text-[9vw] leading-none text-text mt-[1vh]">
            6 KB
          </div>
          <div className="text-muted text-[1.5vw] mt-[2vh]">
            stored as a dense float vector
          </div>

          <div className="mt-[6vh] h-px bg-border" />

          <div className="mt-[4vh] text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            Per memory in RCMT
          </div>
          <div className="font-display font-bold text-[9vw] leading-none text-accent mt-[1vh]">
            28 B
          </div>
          <div className="text-muted text-[1.5vw] mt-[2vh]">
            a position, a tier, a timestamp
          </div>
        </div>
      </div>
    </div>
  );
}
