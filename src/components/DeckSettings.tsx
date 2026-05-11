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

  return (
    <section className="deck-settings" aria-label="Deck settings">
      <div className="deck-settings__row">
        <label htmlFor="deck-settings-order">Deck order (n)</label>
        <select
          id="deck-settings-order"
          value={String(order)}
          onChange={handleOrderChange}
          disabled={orderSelectorDisabled}
        >
          {validOrders.map((n) => (
            <option key={n} value={String(n)}>
              {n} ({deckSize(n)} cards)
            </option>
          ))}
        </select>
      </div>

      <div className="deck-settings__row">
        <label htmlFor="deck-settings-seed">Seed</label>
        <input
          id="deck-settings-seed"
          type="text"
          inputMode="numeric"
          value={seedDraft}
          onChange={handleSeedChange}
        />
        <button type="button" onClick={handleReroll}>
          Re-roll
        </button>
      </div>
    </section>
  );
}
