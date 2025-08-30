export default function Controls() {
  return (
    <section className="mt-8 rounded-xl bg-white/5 p-4 border border-white/10">
      <h2 className="text-xl font-semibold">How to play</h2>
      <ul className="mt-2 grid gap-1 text-sm text-white/80 sm:grid-cols-2">
        <li>Left/Right or A/D: Move</li>
        <li>Space or W/Up: Jump</li>
        <li>Enter: Start/Restart</li>
        <li>Bonk mystery blocks from below to reveal coins</li>
      </ul>
    </section>
  );
}
