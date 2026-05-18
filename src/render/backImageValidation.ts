/**
 * Pure validator for files dropped onto / picked into the card-back uploader.
 *
 * The allow-list mirrors the `<input accept>` attribute on the card-back file
 * input exactly: `image/png`, `image/jpeg`, `image/webp`. The check exists as
 * belt-and-braces for the click path (the picker's accept attribute is the
 * first line of defence) and as the primary guard for the drag-drop path
 * (where `accept` does not apply).
 */

export const CARD_BACK_REJECTION_MESSAGE =
  'Card back must be a PNG, JPEG, or WebP image';

const ACCEPTED_CARD_BACK_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type BackImageValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function validateBackImageFile(file: File): BackImageValidationResult {
  if (ACCEPTED_CARD_BACK_MIME_TYPES.has(file.type)) {
    return { ok: true };
  }
  return { ok: false, reason: CARD_BACK_REJECTION_MESSAGE };
}
