import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(HERE, 'fixtures');

const fixtureFiles = (): string[] => {
  const all = fs
    .readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.png'))
    .sort();
  if (all.length < 13) {
    throw new Error(
      `Expected at least 13 fixture PNGs in ${FIXTURE_DIR}, found ${all.length}`,
    );
  }
  return all.slice(0, 13).map((name) => path.join(FIXTURE_DIR, name));
};

test('upload 13 images, generate, download a PDF', async ({ page }) => {
  await page.goto('/');

  // Foundation assertions (Slice 1): the page renders inside the new dark
  // Plus Jakarta Sans shell with a sticky header.
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(2, 6, 23)',
  );
  await expect(page.locator('body')).toHaveCSS(
    'font-family',
    /Plus Jakarta Sans/,
  );
  await expect(page.locator('header').first()).toHaveCSS(
    'position',
    'sticky',
  );

  // The dropzone exposes a hidden file input. Use Playwright's setInputFiles
  // on the input — robust across browsers and faster than synthesising drag-drop.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(fixtureFiles());

  // The uploaded thumbnails should render in a responsive CSS grid. jsdom
  // cannot resolve computed grid styles, so this assertion belongs in the
  // real-browser E2E spec.
  const thumbnailGrid = page.getByTestId('thumbnail-grid');
  await expect(thumbnailGrid).toBeVisible();
  await expect(thumbnailGrid).toHaveCSS('display', 'grid');

  // Generate. The button is disabled until enough images are queued.
  const generate = page.getByRole('button', { name: /^generate(?:…|\.\.\.)?$/i });
  await expect(generate).toBeEnabled({ timeout: 5000 });
  await generate.click();

  // Wait for 13 preview cards to appear.
  await expect(page.getByTestId('preview-card')).toHaveCount(13, {
    timeout: 30_000,
  });

  // Trigger Download PDF and assert a download is offered with the right MIME.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download pdf/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
});
