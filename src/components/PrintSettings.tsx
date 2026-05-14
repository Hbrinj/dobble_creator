import { useCallback, useRef, type ChangeEvent, type JSX } from 'react';
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
    <K extends keyof PrintSettingsValue>(
      key: K,
      next: PrintSettingsValue[K],
    ) => {
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
      if (next === 'white' || next === 'transparent')
        update('background', next);
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

  const rowClasses = 'flex items-center gap-3 flex-wrap';
  const labelClasses = 'text-slate-200';
  const selectClasses =
    'bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1 focus:outline-2 focus:outline-amber-500 focus:outline-offset-1';
  const ghostButtonClasses =
    'rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2';

  return (
    <section
      aria-label="Print settings"
      className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-3"
    >
      <h2 className="text-lg font-semibold mb-1">Print Options</h2>

      <div className={rowClasses}>
        <label htmlFor="print-settings-diameter" className={labelClasses}>
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
          className="accent-amber-500"
        />
      </div>

      <div className={rowClasses}>
        <label htmlFor="print-settings-page-size" className={labelClasses}>
          Page size
        </label>
        <select
          id="print-settings-page-size"
          value={value.pageSize}
          onChange={handlePageSizeChange}
          className={selectClasses}
        >
          <option value="A4">A4</option>
          <option value="Letter">US Letter</option>
        </select>
      </div>

      <div className={rowClasses}>
        <label
          htmlFor="print-settings-crop-marks"
          className="flex items-center gap-2 text-slate-200"
        >
          <input
            id="print-settings-crop-marks"
            type="checkbox"
            checked={value.cropMarks}
            onChange={handleCropMarksToggle}
            className="accent-amber-500"
          />
          Crop marks
        </label>
      </div>

      <div className={rowClasses}>
        <label
          htmlFor="print-settings-bleed"
          className="flex items-center gap-2 text-slate-200"
        >
          <input
            id="print-settings-bleed"
            type="checkbox"
            checked={value.bleed}
            onChange={handleBleedToggle}
            className="accent-amber-500"
          />
          Bleed (2&nbsp;mm)
        </label>
      </div>

      <div className={rowClasses}>
        <label htmlFor="print-settings-background" className={labelClasses}>
          Background
        </label>
        <select
          id="print-settings-background"
          value={value.background}
          onChange={handleBackgroundChange}
          className={selectClasses}
        >
          <option value="white">White</option>
          <option value="transparent">Transparent</option>
        </select>
      </div>

      <div className={rowClasses}>
        <label htmlFor="print-settings-back-image" className={labelClasses}>
          Card back image
        </label>
        <input
          id="print-settings-back-image"
          ref={backInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleBackImageChange}
          className="text-slate-300 text-sm"
        />
        {backImage ? (
          <>
            <span className="text-slate-300 text-sm">{backImage.name}</span>
            <button
              type="button"
              onClick={handleRemoveBackImage}
              aria-label="Remove back image"
              className={ghostButtonClasses}
            >
              Remove
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
