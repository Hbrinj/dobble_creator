import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from './UploadDropzone';

const makeFile = (name: string, type: string, sizeMb = 0.01): File => {
  const bytes = new Uint8Array(Math.max(1, Math.round(sizeMb * 1024 * 1024)));
  return new File([bytes], name, { type });
};

const dispatchWithDataTransfer = (
  zone: HTMLElement,
  type: string,
  files: File[],
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: f.type,
        getAsFile: () => f,
      })),
      types: ['Files'],
    },
  });
  zone.dispatchEvent(event);
};

const dropFiles = async (zone: HTMLElement, files: File[]): Promise<void> => {
  dispatchWithDataTransfer(zone, 'dragover', files);
  dispatchWithDataTransfer(zone, 'drop', files);
  // Give React state updates a tick to flush.
  await Promise.resolve();
};

describe('UploadDropzone', () => {
  it('accepts PNG, JPEG, WebP, and SVG files via drop', async () => {
    const onImagesAdded = vi.fn();
    const onWarning = vi.fn();
    const onError = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={onWarning}
        onError={onError}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    const files = [
      makeFile('a.png', 'image/png'),
      makeFile('b.jpg', 'image/jpeg'),
      makeFile('c.webp', 'image/webp'),
      makeFile('d.svg', 'image/svg+xml'),
    ];
    await dropFiles(zone, files);
    expect(onImagesAdded).toHaveBeenCalledTimes(1);
    expect(onImagesAdded.mock.calls[0]![0]).toHaveLength(4);
    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects non-image files and emits an error', async () => {
    const onImagesAdded = vi.fn();
    const onError = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={vi.fn()}
        onError={onError}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    const files = [
      makeFile('a.png', 'image/png'),
      makeFile('doc.pdf', 'application/pdf'),
    ];
    await dropFiles(zone, files);
    expect(onImagesAdded).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'a.png' })]),
    );
    expect(onImagesAdded.mock.calls[0]![0]).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toMatch(/pdf|unsupported/i);
  });

  it('emits a soft warning for files larger than 5MB', async () => {
    const onImagesAdded = vi.fn();
    const onWarning = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={onWarning}
        onError={vi.fn()}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    const files = [makeFile('big.png', 'image/png', 10)];
    await dropFiles(zone, files);
    expect(onImagesAdded).toHaveBeenCalledTimes(1);
    expect(onImagesAdded.mock.calls[0]![0]).toHaveLength(1);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0]![0]).toMatch(/big\.png|5\s*mb/i);
  });

  it('opens the file picker on click', async () => {
    const onImagesAdded = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={vi.fn()}
        onError={vi.fn()}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    // The hidden file input should be present
    const input = zone.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const clickSpy = vi.spyOn(input, 'click');
    await userEvent.click(zone);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('accepts files selected via the hidden file input', async () => {
    const onImagesAdded = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={vi.fn()}
        onError={vi.fn()}
      />,
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = makeFile('picked.png', 'image/png');
    await userEvent.upload(input, file);
    expect(onImagesAdded).toHaveBeenCalledWith([file]);
  });

  it('renders a cloud-upload icon and a dashed-border drop target', () => {
    render(
      <UploadDropzone
        onImagesAdded={vi.fn()}
        onWarning={vi.fn()}
        onError={vi.fn()}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    expect(zone.className).toMatch(/border-dashed/);
    // The lucide-react UploadCloud icon renders as an inline SVG inside the
    // dropzone.
    expect(zone.querySelector('svg')).not.toBeNull();
  });

  it('handles the edge case of dropping zero files without notifying parent', async () => {
    const onImagesAdded = vi.fn();
    const onError = vi.fn();
    render(
      <UploadDropzone
        onImagesAdded={onImagesAdded}
        onWarning={vi.fn()}
        onError={onError}
      />,
    );
    const zone = screen.getByRole('button', { name: /upload images/i });
    await dropFiles(zone, []);
    expect(onImagesAdded).not.toHaveBeenCalled();
  });
});
