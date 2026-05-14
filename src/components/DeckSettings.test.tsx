import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckSettings } from './DeckSettings';

describe('DeckSettings', () => {
  it('shows the auto-picked order as the default when no override is supplied', () => {
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={12345}
        onOrderChange={vi.fn()}
        onSeedChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/deck order/i) as HTMLSelectElement;
    expect(select.value).toBe('5');
  });

  it('lists only valid primes whose deck size fits the image count', () => {
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/deck order/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    // 7^2+7+1 = 57 > 31, so 7 must NOT be present. 2,3,5 must all be present.
    expect(values).toEqual(['2', '3', '5']);
  });

  it('emits onOrderChange when the user picks a different order', async () => {
    const onOrderChange = vi.fn();
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={onOrderChange}
        onSeedChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/deck order/i);
    await userEvent.selectOptions(select, '3');
    expect(onOrderChange).toHaveBeenCalledWith(3);
  });

  it('renders the current seed in the seed input', () => {
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={424242}
        onOrderChange={vi.fn()}
        onSeedChange={vi.fn()}
      />,
    );
    const seedInput = screen.getByLabelText(/seed/i) as HTMLInputElement;
    expect(seedInput.value).toBe('424242');
  });

  it('emits a fresh seed when the Re-roll button is clicked', async () => {
    const onSeedChange = vi.fn();
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={onSeedChange}
      />,
    );
    const button = screen.getByRole('button', { name: /re-?roll/i });
    await userEvent.click(button);
    expect(onSeedChange).toHaveBeenCalledTimes(1);
    const newSeed = onSeedChange.mock.calls[0]![0] as number;
    expect(Number.isInteger(newSeed)).toBe(true);
    expect(newSeed).not.toBe(1);
  });

  it('emits onSeedChange with the parsed integer when the user pastes/edits the seed input', async () => {
    const onSeedChange = vi.fn();
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={onSeedChange}
      />,
    );
    const seedInput = screen.getByLabelText(/seed/i);
    await userEvent.clear(seedInput);
    await userEvent.type(seedInput, '987654');
    // Final call should reflect the full pasted value.
    expect(onSeedChange).toHaveBeenLastCalledWith(987654);
  });

  it('ignores non-numeric seed input (edge case)', async () => {
    const onSeedChange = vi.fn();
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={onSeedChange}
      />,
    );
    const seedInput = screen.getByLabelText(/seed/i);
    await userEvent.clear(seedInput);
    await userEvent.type(seedInput, 'abc');
    // No numeric value emitted from purely-non-numeric input.
    expect(onSeedChange).not.toHaveBeenCalled();
  });

  it('renders within a titled card with a "Deck Options" h2', () => {
    render(
      <DeckSettings
        imageCount={31}
        order={5}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: /deck options/i }),
    ).toBeInTheDocument();
  });

  it('disables the order selector when only one valid order exists', () => {
    render(
      <DeckSettings
        imageCount={7}
        order={2}
        seed={1}
        onOrderChange={vi.fn()}
        onSeedChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/deck order/i) as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['2']);
  });
});
