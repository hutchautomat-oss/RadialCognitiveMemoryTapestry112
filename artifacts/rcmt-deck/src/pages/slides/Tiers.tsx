export default function Tiers() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body p-[6vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between text-muted text-[1.3vw] uppercase tracking-[0.3em]">
        <span className="text-accent">// 04</span>
        <span>Five Tiers</span>
        <span>05 / 10</span>
      </div>

      <div className="pt-[14vh]">
        <h2 className="font-display font-bold text-[4.5vw] leading-[0.95] tracking-tight text-balance max-w-[60vw]">
          Every thought lands in
          <span className="block text-accent">one of five kinds.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-5 gap-[2vw]">
        <div className="border-t-2 border-warm pt-[2.5vh]">
          <div className="text-warm text-[1.3vw] uppercase tracking-[0.3em]">
            Inner
          </div>
          <div className="font-display font-bold text-[2.8vw] mt-[1vh]">Fact</div>
          <div className="text-muted text-[1.4vw] mt-[1.5vh] leading-snug">
            Hard things you have verified.
          </div>
        </div>

        <div className="border-t-2 border-nominal pt-[2.5vh]">
          <div className="text-nominal text-[1.3vw] uppercase tracking-[0.3em]">
            Inside
          </div>
          <div className="font-display font-bold text-[2.8vw] mt-[1vh]">Scenario</div>
          <div className="text-muted text-[1.4vw] mt-[1.5vh] leading-snug">
            Lived situations and stories.
          </div>
        </div>

        <div className="border-t-2 border-accent pt-[2.5vh]">
          <div className="text-accent text-[1.3vw] uppercase tracking-[0.3em]">
            Middle
          </div>
          <div className="font-display font-bold text-[2.8vw] mt-[1vh]">Metric</div>
          <div className="text-muted text-[1.4vw] mt-[1.5vh] leading-snug">
            Numbers worth remembering.
          </div>
        </div>

        <div className="border-t-2 border-text/60 pt-[2.5vh]">
          <div className="text-text/70 text-[1.3vw] uppercase tracking-[0.3em]">
            Outer
          </div>
          <div className="font-display font-bold text-[2.8vw] mt-[1vh]">Theory</div>
          <div className="text-muted text-[1.4vw] mt-[1.5vh] leading-snug">
            Hunches you are still testing.
          </div>
        </div>

        <div className="border-t-2 border-muted pt-[2.5vh]">
          <div className="text-muted text-[1.3vw] uppercase tracking-[0.3em]">
            Rim
          </div>
          <div className="font-display font-bold text-[2.8vw] mt-[1vh]">Dream</div>
          <div className="text-muted text-[1.4vw] mt-[1.5vh] leading-snug">
            Wild associations, half-formed.
          </div>
        </div>
      </div>
    </div>
  );
}
