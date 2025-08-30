import Hero from './components/Hero';
import Game from './components/Game';
import Controls from './components/Controls';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-[#0b0f1a] text-white">
      <Hero />
      <main className="mx-auto max-w-6xl px-4">
        <Controls />
        <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-3">
          <Game />
        </div>
      </main>
      <Footer />
    </div>
  );
}
