import {
  useCallback,
  useRef,
  type ChangeEvent,
  type JSX,
} from 'react';
import {
  MAX_DIAMETER_MM,
  MIN_DIAMETER_MM,
  type PrintSettingsValue,
} from './printSettingsTypes';

export interface PrintSettingsProps {
  readonly value: PrintSettingsValue;
  /** Optional user-supplied back image. */
  readonly backImage: File | null;
  readonly onChange: (next: PrintSettingsValue) => void;
  readonly onBackImageChange: (file: File | null) => void;
}

/**
 * Print-layout controls: card diameter, page size, crop marks, bleed, card
 * background, and an optional single-file card-back upload slot. All values
 * are controlled by the parent; this component just renders the current value
 * and emits `onChange` (for the settings struct) or `onBackImageChange` (for
 * the back file) on user input.
 */
export function PrintSettings({
  value,
  backImage,
  onChange,
  onBackImageChange,
}: PrintSettingsProps): JSX.Element {
  const backInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    <K extends keyof PrintSettingsValue>(key: K, next: PrintSettingsValue[K]) => {
      onChange({ ...value, [key]: next });
    },
    [onChange, value],
  );

  const handleDiameterChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseInt(event.target.value, 10);
      if (!Number.isInteger(parsed)) return;
      const clamped = Math.max(
        MIN_DIAMETER_MM,
        Math.min(MAX_DIAMETER_MM, parsed),
      );
      update('cardDiameterMm', clamped);
    },
    [update],
  );

  const handlePageSizeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === 'A4' || next === 'Letter') update('pageSize', next);
    },
    [update],
  );

  const handleBackgroundChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === 'white' || next === 'transparent') update('background', next);
    },
    [update],
  );

  const handleCropMarksToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      update('cropMarks', event.target.checked),
    [update],
  );

  const handleBleedToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      update('bleed', event.target.checked),
    [update],
  );

  const handleBackImageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      onBackImageChange(file);
    },
    [onBackImageChange],
  );

  const handleRemoveBackImage = useCallback(() => {
    onBackImageChange(null);
    if (backInputRef.current) backInputRef.current.value = '';
  }, [onBackImageChange]);

  return (
    <section className="print-settings" aria-label="Print settings">
      <div className="print-settings__row">
        <label htmlFor="print-settings-diameter">
          Card diameter (mm): {value.cardDiameterMm}
        </label>
        <input
          id="print-settings-diameter"
          type="range"
          min={MIN_DIAMETER_MM}
          max={MAX_DIAMETER_MM}
          step={1}
          value={value.cardDiameterMm}
          onChange={handleDiameterChange}
        />
      </div>

      <div className="print-settings__row">
        <label htmlFor="print-settings-page-size">Page size</label>
        <select
          id="print-settings-page-size"
          value={value.pageSize}
          onChange={handlePageSizeChange}
        >
          <option value="A4">A4</option>
          <option value="Letter">US Letter</option>
        </select>
      </div>

      <div className="print-settings__row">
        <label htmlFor="print-settings-crop-marks">
          <input
            id="print-settings-crop-marks"
            type="checkbox"
            checked={value.cropMarks}
            onChange={handleCropMarksToggle}
          />
          Crop marks
        </label>
      </div>

      <div className="print-settings__row">
        <label htmlFor="print-settings-bleed">
          <input
            id="print-settings-bleed"
            type="checkbox"
            checked={value.bleed}
            onChange={handleBleedToggle}
          />
          Bleed (2&nbsp;mm)
        </label>
      </div>

      <div className="print-settings__row">
        <label htmlFor="print-settings-background">Background</label>
        <select
          id="print-settings-background"
          value={value.background}
          onChange={handleBackgroundChange}
        >
          <option value="white">White</option>
          <option value="transparent">Transparent</option>
        </select>
      </div>

      <div className="print-settings__row">
        <label htmlFor="print-settings-back-image">Card back image</label>
        <input
          id="print-settings-back-image"
          ref={backInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleBackImageChange}
        />
        {backImage ? (
          <>
            <span className="print-settings__back-name">{backImage.name}</span>
            <button
              type="button"
              onClick={handleRemoveBackImage}
              aria-label="Remove back image"
            >
              Remove
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
