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
  it('defaults match Decision 10 (85mm, A4, crop marks on, bleed on, white background, no back image)', () => {
    expect(DEFAULT_PRINT_SETTINGS).toEqual({
      cardDiameterMm: 85,
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
});
