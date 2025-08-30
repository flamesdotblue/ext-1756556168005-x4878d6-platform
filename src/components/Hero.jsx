import Spline from '@splinetool/react-spline';
import { Rocket, Star } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative w-full h-[60vh] overflow-hidden">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/EFlEghJH3qCmzyRi/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#0b0f1a]" />
      <div className="relative z-10 flex h-full max-w-6xl mx-auto px-4 items-center">
        <div className="backdrop-blur-sm bg-black/20 rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3">
            <Rocket className="text-yellow-300" />
            <span className="uppercase tracking-widest text-xs text-yellow-300">Retro Playable Demo</span>
          </div>
          <h1 className="mt-2 text-4xl sm:text-6xl font-extrabold leading-tight">
            Pixel Plumber: World 1-1 (Homage)
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">
            A lovingly crafted, original retro platformer inspired by classic side-scrollers. Run, jump, bonk blocks, collect coins and reach the flag. All code and art are original.
          </p>
          <div className="mt-4 flex items-center gap-3 text-yellow-300">
            <Star size={18} />
            <span className="text-sm">Arrows/WASD to move • Space to jump • Enter to start</span>
          </div>
        </div>
      </div>
    </section>
  );
}
