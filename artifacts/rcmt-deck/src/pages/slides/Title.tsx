const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <img
        src={`${base}tapestry-hero.png`}
        crossOrigin="anonymous"
        alt="Foveated lattice"
        className="absolute inset-0 w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.5vw] tracking-[0.3em] uppercase">
        <span>RCMT // VISION</span>
        <span className="text-accent">REV 26.05</span>
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] right-[6vw]">
        <div className="text-accent text-[1.6vw] tracking-[0.4em] uppercase mb-[3vh]">
          Radial Cognitive Memory Tapestry
        </div>
        <h1 className="font-display font-bold text-[8vw] leading-[0.92] tracking-tighter text-balance max-w-[80vw]">
          A memory that
          <span className="block text-accent">thinks in shape,</span>
          <span className="block">not in numbers.</span>
        </h1>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.25em]">
        <span>Sovereign · Append-Only · Peer-Merged</span>
        <span>01 / 10</span>
      </div>
    </div>
  );
}
