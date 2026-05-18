import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrintSettings } from './PrintSettings';
import {
  DEFAULT_PRINT_SETTINGS,
  type PrintSettingsValue,
} from './printSettingsTypes';

const baseValue = (): PrintSettingsValue => ({ ...DEFAULT_PRINT_SETTINGS });

describe('PrintSettings', () => {
  it('defaults match Decision 10 (85mm, A4, crop marks on, bleed on, white background) plus the 5 mm card edge margin from card-edge-margin Decision 2', () => {
    expect(DEFAULT_PRINT_SETTINGS).toEqual({
      cardDiameterMm: 85,
      cardEdgeMarginMm: 5,
      pageSize: 'A4',
      cropMarks: true,
      bleed: true,
      background: 'white',
    } satisfies PrintSettingsValue);
  });

  it('renders the current values into its inputs', () => {
    render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
    expect(
      (screen.getByLabelText(/card diameter/i) as HTMLInputElement).value,
    ).toBe('85');
    expect(
      (screen.getByLabelText(/page size/i) as HTMLSelectElement).value,
    ).toBe('A4');
    expect(
      (screen.getByLabelText(/crop marks/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByLabelText(/bleed/i) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText(/background/i) as HTMLSelectElement).value,
    ).toBe('white');
  });

  it('emits onChange with a new diameter when the slider changes', () => {
    const onChange = vi.fn();
    render(<PrintSettings value={baseValue()} onChange={onChange} />);
    const slider = screen.getByLabelText(/card diameter/i) as HTMLInputElement;
    // Range slider: fireEvent.change is the RTL-recommended path because
    // user-event has no real keyboard model for sliders.
    fireEvent.change(slider, { target: { value: '72' } });
    expect(onChange).toHaveBeenCalledWith({
      ...baseValue(),
      cardDiameterMm: 72,
    });
  });

  it('emits onChange when crop marks are toggled', async () => {
    const onChange = vi.fn();
    render(<PrintSettings value={baseValue()} onChange={onChange} />);
    const checkbox = screen.getByLabelText(/crop marks/i);
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ...baseValue(), cropMarks: false });
  });

  it('emits onChange when bleed is toggled', async () => {
    const onChange = vi.fn();
    render(<PrintSettings value={baseValue()} onChange={onChange} />);
    const checkbox = screen.getByLabelText(/bleed/i);
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ...baseValue(), bleed: false });
  });

  it('emits onChange when page size changes', async () => {
    const onChange = vi.fn();
    render(<PrintSettings value={baseValue()} onChange={onChange} />);
    await userEvent.selectOptions(
      screen.getByLabelText(/page size/i),
      'Letter',
    );
    expect(onChange).toHaveBeenCalledWith({
      ...baseValue(),
      pageSize: 'Letter',
    });
  });

  it('emits onChange when the background option changes', async () => {
    const onChange = vi.fn();
    render(<PrintSettings value={baseValue()} onChange={onChange} />);
    await userEvent.selectOptions(
      screen.getByLabelText(/background/i),
      'transparent',
    );
    expect(onChange).toHaveBeenCalledWith({
      ...baseValue(),
      background: 'transparent',
    });
  });

  it('no longer renders the back-image upload row (moved to CardBack)', () => {
    render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
    // The "Card back image" label and its file input belong to the CardBack
    // section now (Decision 6); PrintSettings must not render either.
    expect(screen.queryByLabelText(/card back image/i)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /remove back image/i }),
    ).toBeNull();
  });

  it('renders within a titled card with a "Print Options" h2', () => {
    render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: /print options/i }),
    ).toBeInTheDocument();
  });

  it('clamps card diameter to the 60–100 mm range (edge case)', () => {
    render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
    const slider = screen.getByLabelText(/card diameter/i) as HTMLInputElement;
    expect(slider.min).toBe('60');
    expect(slider.max).toBe('100');
  });

  describe('card edge margin (mm)', () => {
    it('renders the margin input with the default value 5', () => {
      render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      expect(input.value).toBe('5');
    });

    it('declares min=0, max=15, step=1 on the margin input', () => {
      render(<PrintSettings value={baseValue()} onChange={vi.fn()} />);
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      expect(input.min).toBe('0');
      expect(input.max).toBe('15');
      expect(input.step).toBe('1');
    });

    it('emits onChange with the new margin via the same setter shape as cardDiameterMm', () => {
      const onChange = vi.fn();
      render(<PrintSettings value={baseValue()} onChange={onChange} />);
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      // Range inputs: fireEvent.change is the RTL-recommended path because
      // user-event has no real keyboard model for sliders — matches the
      // existing cardDiameterMm test above.
      fireEvent.change(input, { target: { value: '10' } });
      expect(onChange).toHaveBeenCalledWith({
        ...baseValue(),
        cardEdgeMarginMm: 10,
      });
    });

    it('clamps margin values outside [0, 15] to the legal range (edge case)', () => {
      const onChange = vi.fn();
      render(<PrintSettings value={baseValue()} onChange={onChange} />);
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      // Range inputs natively clamp via min/max, but the change handler must
      // mirror cardDiameterMm's defensive clamp so programmatic values can't
      // slip an out-of-range setting through.
      fireEvent.change(input, { target: { value: '99' } });
      expect(onChange).toHaveBeenCalledWith({
        ...baseValue(),
        cardEdgeMarginMm: 15,
      });
      fireEvent.change(input, { target: { value: '-5' } });
      expect(onChange).toHaveBeenCalledWith({
        ...baseValue(),
        cardEdgeMarginMm: 0,
      });
    });
  });
});
