const base = import.meta.env.BASE_URL;

export default function Density() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <img
        src={`${base}density-compare.png`}
        crossOrigin="anonymous"
        alt="Density comparison"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/40" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 02</span>
        <span>Density</span>
        <span>03 / 10</span>
      </div>

      <div className="absolute top-[22vh] left-[6vw] right-[6vw]">
        <h2 className="font-display font-bold text-[5.5vw] leading-[0.95] tracking-tight text-balance max-w-[70vw]">
          An entire mind fits in
          <span className="block text-accent">a quarter of a megabyte.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div className="border-t border-border pt-[3vh]">
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            Tapestry size
          </div>
          <div className="font-display font-bold text-[5vw] leading-none mt-[1.5vh]">
            224 KB
          </div>
          <div className="text-text/80 text-[1.5vw] mt-[1.5vh]">
            for 8,000 memories, in full
          </div>
        </div>

        <div className="border-t border-accent pt-[3vh]">
          <div className="text-accent text-[1.3vw] uppercase tracking-[0.3em]">
            Vs. a vector store
          </div>
          <div className="font-display font-bold text-[5vw] leading-none mt-[1.5vh] text-accent">
            ~100×
          </div>
          <div className="text-text/80 text-[1.5vw] mt-[1.5vh]">
            denser than the conventional alternative
          </div>
        </div>

        <div className="border-t border-border pt-[3vh]">
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            What it carries
          </div>
          <div className="font-display font-bold text-[5vw] leading-none mt-[1.5vh]">
            One brain
          </div>
          <div className="text-text/80 text-[1.5vw] mt-[1.5vh]">
            another AI can pick up mid-thought
          </div>
        </div>
      </div>
    </div>
  );
}
