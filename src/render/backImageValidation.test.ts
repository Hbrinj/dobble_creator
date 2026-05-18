import { describe, it, expect } from 'vitest';
import {
  validateBackImageFile,
  CARD_BACK_REJECTION_MESSAGE,
} from './backImageValidation';

const makeFile = (type: string): File =>
  new File([new Uint8Array([1, 2, 3])], 'back', { type });

describe('validateBackImageFile', () => {
  it.each([['image/png'], ['image/jpeg'], ['image/webp']])(
    'accepts %s',
    (mime) => {
      expect(validateBackImageFile(makeFile(mime))).toEqual({ ok: true });
    },
  );

  it.each([['application/pdf'], ['text/plain'], ['image/gif'], ['']])(
    'rejects %s with the canonical reason',
    (mime) => {
      const result = validateBackImageFile(makeFile(mime));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(CARD_BACK_REJECTION_MESSAGE);
      }
    },
  );

  it('exposes the same rejection message as the exported constant', () => {
    expect(CARD_BACK_REJECTION_MESSAGE).toBe(
      'Card back must be a PNG, JPEG, or WebP image',
    );
  });
});
