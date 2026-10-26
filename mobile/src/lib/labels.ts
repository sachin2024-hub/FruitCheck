import type { ImageSourcePropType } from 'react-native';

// Model labels come from the training artifact classes.json, e.g. "apple_ripe".
export type FruitSlug = 'apple' | 'banana' | 'mango';
export type Ripeness = 'ripe' | 'unripe';

export const FRUITS: { slug: FruitSlug; name: string }[] = [
  { slug: 'apple', name: 'Apple' },
  { slug: 'banana', name: 'Banana' },
  { slug: 'mango', name: 'Mango' },
];

// Real reference photos taken from the project's training dataset (assets/fruits).
export const FRUIT_PHOTOS: Record<`${FruitSlug}-${Ripeness}`, ImageSourcePropType> = {
  'apple-ripe': require('@/assets/fruits/apple-ripe.jpg'),
  'apple-unripe': require('@/assets/fruits/apple-unripe.jpg'),
  'banana-ripe': require('@/assets/fruits/banana-ripe.jpg'),
  'banana-unripe': require('@/assets/fruits/banana-unripe.jpg'),
  'mango-ripe': require('@/assets/fruits/mango-ripe.jpg'),
  'mango-unripe': require('@/assets/fruits/mango-unripe.jpg'),
};

export type ParsedLabel = { fruit: string; fruitSlug: string; ripeness: Ripeness | null; label: string };

export function parseLabel(label: string): ParsedLabel {
  const i = label.lastIndexOf('_');
  const slug = i > 0 ? label.slice(0, i) : label;
  const r = i > 0 ? label.slice(i + 1) : '';
  const known = FRUITS.find((f) => f.slug === slug);
  return {
    label,
    fruitSlug: slug,
    fruit: known?.name ?? slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    ripeness: r === 'ripe' || r === 'unripe' ? r : null,
  };
}

export const labelText = (label: string) => {
  const p = parseLabel(label);
  return p.ripeness ? `${p.ripeness === 'ripe' ? 'Ripe' : 'Unripe'} ${p.fruit}` : p.fruit;
};
