export default function Peers() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body p-[6vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 06</span>
        <span>Peer-merged</span>
        <span>07 / 10</span>
      </div>

      <div className="pt-[14vh] max-w-[70vw]">
        <h2 className="font-display font-bold text-[5vw] leading-[0.95] tracking-tight text-balance">
          No central server.
          <span className="block text-accent">Every peer holds the whole mind.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div>
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em] mb-[2vh]">
            01 — Write locally
          </div>
          <p className="text-[1.7vw] leading-relaxed text-text/85 text-pretty">
            A new thought lands in your own lattice first.
            Your machine never waits for permission.
          </p>
        </div>

        <div>
          <div className="text-accent text-[1.3vw] uppercase tracking-[0.3em] mb-[2vh]">
            02 — Broadcast 28 bytes
          </div>
          <p className="text-[1.7vw] leading-relaxed text-text/85 text-pretty">
            A tiny packet ships to every peer.
            Position, tier, timestamp. Nothing else.
          </p>
        </div>

        <div>
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em] mb-[2vh]">
            03 — Latest wins
          </div>
          <p className="text-[1.7vw] leading-relaxed text-text/85 text-pretty">
            If two peers touch the same slot, the newer timestamp
            settles it. No voting, no merge conflicts.
          </p>
        </div>
      </div>
    </div>
  );
}
