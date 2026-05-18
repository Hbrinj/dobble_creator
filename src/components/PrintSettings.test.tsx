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
  it('defaults match Decision 10 (85mm, A4, crop marks on, bleed on, white background, no back image) plus the 5 mm card edge margin from card-edge-margin Decision 2', () => {
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
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={vi.fn()}
        onBackImageChange={vi.fn()}
      />,
    );
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
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={onChange}
        onBackImageChange={vi.fn()}
      />,
    );
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
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={onChange}
        onBackImageChange={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(/crop marks/i);
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ...baseValue(), cropMarks: false });
  });

  it('emits onChange when bleed is toggled', async () => {
    const onChange = vi.fn();
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={onChange}
        onBackImageChange={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(/bleed/i);
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ...baseValue(), bleed: false });
  });

  it('emits onChange when page size changes', async () => {
    const onChange = vi.fn();
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={onChange}
        onBackImageChange={vi.fn()}
      />,
    );
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
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={onChange}
        onBackImageChange={vi.fn()}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/background/i),
      'transparent',
    );
    expect(onChange).toHaveBeenCalledWith({
      ...baseValue(),
      background: 'transparent',
    });
  });

  it('emits onBackImageChange when a PNG is uploaded to the back image slot', async () => {
    const onBackImageChange = vi.fn();
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={vi.fn()}
        onBackImageChange={onBackImageChange}
      />,
    );
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'back.png', {
      type: 'image/png',
    });
    await userEvent.upload(input, file);
    expect(onBackImageChange).toHaveBeenCalledWith(file);
  });

  it('emits null to onBackImageChange when the "Remove" button is clicked (edge case)', async () => {
    const onBackImageChange = vi.fn();
    const backFile = new File([new Uint8Array([1])], 'back.png', {
      type: 'image/png',
    });
    render(
      <PrintSettings
        value={baseValue()}
        backImage={backFile}
        onChange={vi.fn()}
        onBackImageChange={onBackImageChange}
      />,
    );
    const removeButton = screen.getByRole('button', {
      name: /remove back image/i,
    });
    await userEvent.click(removeButton);
    expect(onBackImageChange).toHaveBeenCalledWith(null);
  });

  it('renders within a titled card with a "Print Options" h2', () => {
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={vi.fn()}
        onBackImageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: /print options/i }),
    ).toBeInTheDocument();
  });

  it('clamps card diameter to the 60–100 mm range (edge case)', () => {
    render(
      <PrintSettings
        value={baseValue()}
        backImage={null}
        onChange={vi.fn()}
        onBackImageChange={vi.fn()}
      />,
    );
    const slider = screen.getByLabelText(/card diameter/i) as HTMLInputElement;
    expect(slider.min).toBe('60');
    expect(slider.max).toBe('100');
  });

  describe('card edge margin (mm)', () => {
    it('renders the margin input with the default value 5', () => {
      render(
        <PrintSettings
          value={baseValue()}
          backImage={null}
          onChange={vi.fn()}
          onBackImageChange={vi.fn()}
        />,
      );
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      expect(input.value).toBe('5');
    });

    it('declares min=0, max=15, step=1 on the margin input', () => {
      render(
        <PrintSettings
          value={baseValue()}
          backImage={null}
          onChange={vi.fn()}
          onBackImageChange={vi.fn()}
        />,
      );
      const input = screen.getByLabelText(/edge margin/i) as HTMLInputElement;
      expect(input.min).toBe('0');
      expect(input.max).toBe('15');
      expect(input.step).toBe('1');
    });

    it('emits onChange with the new margin via the same setter shape as cardDiameterMm', () => {
      const onChange = vi.fn();
      render(
        <PrintSettings
          value={baseValue()}
          backImage={null}
          onChange={onChange}
          onBackImageChange={vi.fn()}
        />,
      );
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
      render(
        <PrintSettings
          value={baseValue()}
          backImage={null}
          onChange={onChange}
          onBackImageChange={vi.fn()}
        />,
      );
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
