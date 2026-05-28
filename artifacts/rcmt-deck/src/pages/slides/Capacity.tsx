export default function Capacity() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 05</span>
        <span>Capacity</span>
        <span>06 / 10</span>
      </div>

      <div className="absolute inset-0 flex flex-col items-start justify-center px-[6vw]">
        <div className="text-muted text-[1.5vw] uppercase tracking-[0.3em] mb-[2vh]">
          A hard cap of
        </div>
        <div className="font-display font-bold text-[18vw] leading-[0.85] tracking-tighter text-accent">
          8,000
        </div>
        <div className="text-text text-[2.4vw] mt-[2vh] font-display font-medium">
          memories. Always.
        </div>
        <p className="mt-[4vh] text-[1.8vw] leading-relaxed text-text/80 max-w-[55vw] text-pretty">
          When the lattice fills, the oldest fading slot is recycled
          to make room for what just arrived. The mind stays the same
          size; only its contents move.
        </p>
      </div>

      <div className="absolute bottom-[8vh] right-[6vw] text-muted text-[1.3vw] uppercase tracking-[0.3em] text-right">
        <div>One draw call</div>
        <div className="text-accent">One brain shape</div>
      </div>
    </div>
  );
}
