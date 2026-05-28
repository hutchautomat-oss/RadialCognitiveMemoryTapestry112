const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <img
        src={`${base}tapestry-hero.png`}
        crossOrigin="anonymous"
        alt="Tapestry"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/30" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 09</span>
        <span>End of deck</span>
        <span>10 / 10</span>
      </div>

      <div className="absolute inset-0 flex flex-col items-start justify-center px-[6vw]">
        <div className="text-accent text-[1.6vw] tracking-[0.4em] uppercase mb-[3vh]">
          RCMT
        </div>
        <h2 className="font-display font-bold text-[7vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Dense. Append-only.
          <span className="block text-accent">Yours.</span>
        </h2>
        <p className="mt-[5vh] text-[1.9vw] leading-relaxed text-text/85 max-w-[55vw] text-pretty">
          A cognitive substrate small enough to carry,
          rich enough to hand off, and quiet enough to keep.
        </p>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span>Radial Cognitive Memory Tapestry</span>
        <span className="text-accent">A sovereign brain in 224 KB</span>
      </div>
    </div>
  );
}
