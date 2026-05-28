const base = import.meta.env.BASE_URL;

export default function Idea() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="grid grid-cols-12 h-full">
        <div className="col-span-5 flex flex-col justify-between p-[5vw]">
          <div className="flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            <span className="text-accent">// 03</span>
            <span>04 / 10</span>
          </div>

          <div>
            <div className="text-muted text-[1.5vw] uppercase tracking-[0.3em] mb-[3vh]">
              The idea
            </div>
            <h2 className="font-display font-bold text-[5vw] leading-[0.95] tracking-tight text-balance">
              Position is
              <span className="block text-accent">the meaning.</span>
            </h2>
            <p className="mt-[4vh] text-[1.9vw] leading-relaxed text-text/85 text-pretty">
              Each thought lands somewhere specific on a 3D sphere.
              Important, well-worn ideas cluster tightly at the core.
              Loose, dreamlike ones drift out to the rim.
            </p>
          </div>

          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            A foveated lattice
          </div>
        </div>

        <div className="col-span-7 relative">
          <img
            src={`${base}tapestry-hero.png`}
            crossOrigin="anonymous"
            alt="Foveated tapestry"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-bg/40" />
          <div className="absolute bottom-[5vh] right-[3vw] text-muted text-[1.3vw] uppercase tracking-[0.3em] text-right">
            <span className="text-accent">Core</span>
            <span className="mx-[1.5vw]">→</span>
            <span>Rim</span>
          </div>
        </div>
      </div>
    </div>
  );
}
