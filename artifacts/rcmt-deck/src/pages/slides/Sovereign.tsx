export default function Sovereign() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body p-[6vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 07</span>
        <span>Sovereign</span>
        <span>08 / 10</span>
      </div>

      <div className="absolute inset-0 grid grid-cols-12 gap-[3vw] px-[6vw] pt-[16vh] pb-[10vh]">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="text-muted text-[1.5vw] uppercase tracking-[0.3em] mb-[3vh]">
            What stays on your device
          </div>
          <h2 className="font-display font-bold text-[4.8vw] leading-[0.95] tracking-tight text-balance">
            Your words never
            <span className="block text-accent">leave your machine.</span>
          </h2>
          <p className="mt-[4vh] text-[1.8vw] leading-relaxed text-text/85 max-w-[42vw] text-pretty">
            Classification runs locally. The model is downloaded once
            and never phones home. What ships between peers is geometry,
            not language.
          </p>
        </div>

        <div className="col-span-5 flex flex-col justify-center gap-[3vh]">
          <div className="border border-border bg-surface p-[2.5vw]">
            <div className="text-nominal text-[1.3vw] uppercase tracking-[0.3em]">
              On device
            </div>
            <div className="mt-[1.5vh] text-text text-[1.7vw] leading-snug">
              Phrase · classification · full tapestry
            </div>
          </div>

          <div className="border border-border bg-surface p-[2.5vw]">
            <div className="text-accent text-[1.3vw] uppercase tracking-[0.3em]">
              Over the wire
            </div>
            <div className="mt-[1.5vh] text-text text-[1.7vw] leading-snug">
              A 28-byte position update. That is all.
            </div>
          </div>

          <div className="border border-border bg-surface p-[2.5vw]">
            <div className="text-warm text-[1.3vw] uppercase tracking-[0.3em]">
              Never sent
            </div>
            <div className="mt-[1.5vh] text-text text-[1.7vw] leading-snug">
              Source text · embeddings · transcripts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
