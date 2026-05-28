export default function WhyItMatters() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body p-[6vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 08</span>
        <span>Why it matters</span>
        <span>09 / 10</span>
      </div>

      <div className="pt-[14vh] max-w-[72vw]">
        <h2 className="font-display font-bold text-[4.8vw] leading-[0.95] tracking-tight text-balance">
          A mind that another mind
          <span className="block text-accent">can pick up mid-thought.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[4vw]">
        <div className="border-t border-border pt-[3vh]">
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em] mb-[2vh]">
            For people
          </div>
          <p className="text-[1.9vw] leading-relaxed text-text/90 text-pretty">
            Your context belongs to you. You can hand it
            to a new assistant, a new device, a teammate
            — and it inherits the shape of your thinking,
            not a transcript.
          </p>
        </div>

        <div className="border-t border-accent pt-[3vh]">
          <div className="text-accent text-[1.3vw] uppercase tracking-[0.3em] mb-[2vh]">
            For machines
          </div>
          <p className="text-[1.9vw] leading-relaxed text-text/90 text-pretty">
            Memory becomes a portable file, not a service bill.
            Two AIs can swap brains the way two phones swap
            contacts.
          </p>
        </div>
      </div>
    </div>
  );
}
