import { useCallback, type ChangeEvent, type JSX } from 'react';
import {
  MAX_CARD_EDGE_MARGIN_MM,
  MAX_DIAMETER_MM,
  MIN_CARD_EDGE_MARGIN_MM,
  MIN_DIAMETER_MM,
  type PrintSettingsValue,
} from './printSettingsTypes';

export interface PrintSettingsProps {
  readonly value: PrintSettingsValue;
  readonly onChange: (next: PrintSettingsValue) => void;
}

/**
 * Print-layout controls: card diameter, page size, crop marks, bleed, card
 * background, and the card-edge margin. The card-back image and its
 * placement live in the dedicated `CardBack` section now (Decision 6 from
 * the back-image-placement feature).
 */
export function PrintSettings({
  value,
  onChange,
}: PrintSettingsProps): JSX.Element {
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

  const handleEdgeMarginChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseInt(event.target.value, 10);
      if (!Number.isInteger(parsed)) return;
      const clamped = Math.max(
        MIN_CARD_EDGE_MARGIN_MM,
        Math.min(MAX_CARD_EDGE_MARGIN_MM, parsed),
      );
      update('cardEdgeMarginMm', clamped);
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

  const rowClasses = 'flex items-center gap-3 flex-wrap';
  const labelClasses = 'text-slate-200';
  const selectClasses =
    'bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1 focus:outline-2 focus:outline-amber-500 focus:outline-offset-1';

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
        <label htmlFor="print-settings-edge-margin" className={labelClasses}>
          Edge margin (mm): {value.cardEdgeMarginMm}
        </label>
        <input
          id="print-settings-edge-margin"
          type="range"
          min={MIN_CARD_EDGE_MARGIN_MM}
          max={MAX_CARD_EDGE_MARGIN_MM}
          step={1}
          value={value.cardEdgeMarginMm}
          onChange={handleEdgeMarginChange}
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
    </section>
  );
}
