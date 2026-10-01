import { describe, expect, it } from 'vitest';
import { FIREFOX_ID, firefoxVersion, manifestFor } from './manifest';

describe('manifestFor', () => {
  it('describes the same extension in every browser', () => {
    for (const browser of ['chrome', 'firefox']) {
      const manifest = manifestFor(browser);
      expect(manifest.name).toBe('poe2perfect');
      expect(manifest.permissions).toEqual(['storage']);
      expect(manifest.homepage_url).toBe('https://github.com/ReSenpai/poe2perfect');
    }
  });

  // A new id would be a new add-on on addons.mozilla.org, with its reviews and users left behind.
  it('gives the Firefox build its lasting id, the Firefox it needs and no data collection', () => {
    expect(manifestFor('firefox').browser_specific_settings).toEqual({
      gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
    });
    expect(FIREFOX_ID).toBe('poe2perfect@resenpai.dev');
  });

  it('leaves Chrome without Firefox settings, which Chrome would refuse', () => {
    expect(manifestFor('chrome').browser_specific_settings).toBeUndefined();
    expect(manifestFor('chrome').version).toBeUndefined();
  });

  it('numbers the Firefox build itself, since addons.mozilla.org takes digits only', () => {
    expect(manifestFor('firefox', '1.3.0').version).toBe('1.3.0');
    expect(manifestFor('chrome', '1.3.0').version).toBeUndefined();
  });
});

describe('firefoxVersion', () => {
  it('keeps a release as it is', () => {
    expect(firefoxVersion('1.2.0')).toBe('1.2.0');
    expect(firefoxVersion('2.0.3')).toBe('2.0.3');
  });

  // addons.mozilla.org sorts versions as numbers, so a pre-release has to sit below the release it leads to.
  it('numbers a pre-release just below its release', () => {
    expect(firefoxVersion('1.3.0-beta.1')).toBe('1.2.999.1');
    expect(firefoxVersion('1.3.2-beta.4')).toBe('1.3.1.4');
    expect(firefoxVersion('2.0.0-beta.2')).toBe('1.999.999.2');
  });

  it('refuses a version it cannot number, rather than guessing', () => {
    expect(() => firefoxVersion('1.2')).toThrow();
    expect(() => firefoxVersion('1.2.0-rc1')).toThrow();
  });
});
