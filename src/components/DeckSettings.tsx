import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type JSX,
} from 'react';
import { SUPPORTED_PRIMES, deckSize } from '../lib/orderPicker';

export interface DeckSettingsProps {
  /** Number of uploaded images currently available. */
  readonly imageCount: number;
  /** Currently active prime order (n). */
  readonly order: number;
  /** Currently active PRNG seed. */
  readonly seed: number;
  readonly onOrderChange: (order: number) => void;
  readonly onSeedChange: (seed: number) => void;
}

const MAX_SEED = 2_147_483_647; // 2^31 - 1, comfortably within mulberry32's 32-bit window.

const generateSeed = (): number => Math.floor(Math.random() * MAX_SEED) + 1;

const isNumericString = (raw: string): boolean => /^[0-9]+$/.test(raw);

/**
 * Deck-level controls: pick a prime order n (auto-bounded by image count) and
 * manage the PRNG seed. Surfaces "Re-roll" (random new seed) and a free-form
 * seed field for reproducing a previously-shared deck.
 *
 * The seed input maintains its own draft string so the user can clear, paste,
 * or correct without losing intermediate keystrokes. Numeric drafts are pushed
 * to the parent via `onSeedChange`; non-numeric drafts are kept local until the
 * user corrects them.
 */
export function DeckSettings({
  imageCount,
  order,
  seed,
  onOrderChange,
  onSeedChange,
}: DeckSettingsProps): JSX.Element {
  const validOrders = useMemo<readonly number[]>(
    () => SUPPORTED_PRIMES.filter((n) => deckSize(n) <= imageCount),
    [imageCount],
  );

  // The seed input keeps a local draft so the user can clear, paste, and edit
  // without intermediate keystrokes being clobbered by the parent re-render.
  // The draft is synced when `seed` changes from outside (e.g. Re-roll) — the
  // canonical React pattern for parent-driven resets without a useEffect.
  const [seedDraft, setSeedDraft] = useState<string>(String(seed));
  const [lastSyncedSeed, setLastSyncedSeed] = useState<number>(seed);
  if (seed !== lastSyncedSeed) {
    const parsedDraft = Number.parseInt(seedDraft, 10);
    if (!Number.isInteger(parsedDraft) || parsedDraft !== seed) {
      setSeedDraft(String(seed));
    }
    setLastSyncedSeed(seed);
  }

  const handleOrderChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const parsed = Number.parseInt(event.target.value, 10);
      if (Number.isInteger(parsed)) onOrderChange(parsed);
    },
    [onOrderChange],
  );

  const handleSeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setSeedDraft(raw);
      const trimmed = raw.trim();
      if (trimmed === '' || !isNumericString(trimmed)) return;
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isInteger(parsed)) onSeedChange(parsed);
    },
    [onSeedChange],
  );

  const handleReroll = useCallback(() => {
    let next = generateSeed();
    if (next === seed) next = (next % MAX_SEED) + 1;
    onSeedChange(next);
  }, [onSeedChange, seed]);

  const orderSelectorDisabled = validOrders.length <= 1;

  const selectClasses =
    'bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1 disabled:opacity-50 focus:outline-2 focus:outline-amber-500 focus:outline-offset-1';
  const textInputClasses =
    'bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1 font-mono focus:outline-2 focus:outline-amber-500 focus:outline-offset-1';
  const ghostButtonClasses =
    'rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2';

  return (
    <section
      aria-label="Deck settings"
      className="bg-slate-900 rounded-xl p-6 border border-slate-800"
    >
      <h2 className="text-lg font-semibold mb-4">Deck Options</h2>

      <div className="flex items-center gap-3 mb-3">
        <label htmlFor="deck-settings-order" className="text-slate-200">
          Deck order (n)
        </label>
        <select
          id="deck-settings-order"
          value={String(order)}
          onChange={handleOrderChange}
          disabled={orderSelectorDisabled}
          className={selectClasses}
        >
          {validOrders.map((n) => (
            <option key={n} value={String(n)}>
              {n} ({deckSize(n)} cards)
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="deck-settings-seed" className="text-slate-200">
          Seed
        </label>
        <input
          id="deck-settings-seed"
          type="text"
          inputMode="numeric"
          value={seedDraft}
          onChange={handleSeedChange}
          className={textInputClasses}
        />
        <button
          type="button"
          onClick={handleReroll}
          className={ghostButtonClasses}
        >
          Re-roll
        </button>
      </div>
    </section>
  );
}
