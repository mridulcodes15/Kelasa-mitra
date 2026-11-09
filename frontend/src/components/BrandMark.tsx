import { BRAND_COLOURS, BRAND_PATHS } from '../lib/brand';

/** The Kelasa Mitra mark: a cream ಕ (drawn as a path) on a teal tile with a marigold dot. Decorative. */
export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-brand-mark>
      <path d={BRAND_PATHS.tile} fill={BRAND_COLOURS.tile} />
      <path d={BRAND_PATHS.ka} fill={BRAND_COLOURS.letter} data-letter="ka" />
      <circle cx="52" cy="12" r="5" fill={BRAND_COLOURS.dot} />
    </svg>
  );
}
