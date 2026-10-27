import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type CategoryId = 'topic' | 'anything' | 'people' | 'plants' | 'sports' | 'wars';
export type FilterKind = 'country' | 'era' | 'obscurity';

export interface Subcategory {
  id: string;
  label: string;
  /** Pool ids (files in src/data/pools) merged to form this subcategory. */
  pools: string[];
  /** Optional year ceiling applied before the user's filters (e.g. "Historical figures"). */
  maxYear?: number;
}

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Accent per color scheme. */
  accent: { light: string; dark: string };
  subcategories: Subcategory[];
  filters: FilterKind[];
  /** What the year in this category means, for filter labels. */
  yearMeaning?: 'born' | 'started';
  /** What the country in this category means, for filter labels. */
  countryMeaning?: string;
}

const PEOPLE_POOLS = [
  'people.leaders',
  'people.politicians',
  'people.writers',
  'people.scientists',
  'people.artists',
  'people.musicians',
  'people.actors',
  'people.athletes',
  'people.military',
];

const PLANT_POOLS = ['plants.flowers', 'plants.trees', 'plants.edible', 'plants.succulents'];

/**
 * All categories are data: add a category or subcategory here (plus its pool in
 * tools/build-pools.mjs) and the UI picks it up without other changes.
 */
export const CATEGORIES: Category[] = [
  {
    // Live mode: the reel is built from a Wikipedia search or category the user types.
    id: 'topic',
    label: 'Any topic',
    icon: 'search',
    accent: { light: '#0B7F86', dark: '#4FD1C5' },
    subcategories: [],
    filters: [],
  },
  {
    id: 'anything',
    label: 'Anything',
    icon: 'sparkles',
    accent: { light: '#7C4DFF', dark: '#A98BFF' },
    subcategories: [],
    filters: [],
  },
  {
    id: 'people',
    label: 'People',
    icon: 'person',
    accent: { light: '#E8572A', dark: '#FF8A5C' },
    filters: ['country', 'era', 'obscurity'],
    yearMeaning: 'born',
    countryMeaning: 'Citizenship',
    subcategories: [
      { id: 'all', label: 'All people', pools: PEOPLE_POOLS },
      { id: 'leaders', label: 'Political leaders', pools: ['people.leaders'] },
      { id: 'politicians', label: 'Politicians', pools: ['people.politicians'] },
      { id: 'historical', label: 'Historical figures', pools: PEOPLE_POOLS, maxYear: 1899 },
      { id: 'writers', label: 'Writers', pools: ['people.writers'] },
      { id: 'scientists', label: 'Scientists', pools: ['people.scientists'] },
      { id: 'artists', label: 'Artists & painters', pools: ['people.artists'] },
      { id: 'musicians', label: 'Musicians', pools: ['people.musicians'] },
      { id: 'actors', label: 'Actors', pools: ['people.actors'] },
      { id: 'athletes', label: 'Athletes', pools: ['people.athletes'] },
      { id: 'military', label: 'Military commanders', pools: ['people.military'] },
    ],
  },
  {
    id: 'plants',
    label: 'Plants',
    icon: 'leaf',
    accent: { light: '#1F9D5C', dark: '#4FD08C' },
    // Native-region data on Wikidata is too sparse for a useful filter, so plants only get obscurity.
    filters: ['obscurity'],
    subcategories: [
      { id: 'all', label: 'All plants', pools: PLANT_POOLS },
      { id: 'flowers', label: 'Flowering plants', pools: ['plants.flowers'] },
      { id: 'trees', label: 'Trees', pools: ['plants.trees'] },
      { id: 'edible', label: 'Edible plants & herbs', pools: ['plants.edible'] },
      { id: 'succulents', label: 'Cacti & succulents', pools: ['plants.succulents'] },
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    icon: 'football',
    accent: { light: '#1E6FF0', dark: '#6AA6FF' },
    filters: ['country', 'obscurity'],
    countryMeaning: 'Country',
    subcategories: [
      { id: 'all', label: 'All sports', pools: ['sports.disciplines', 'sports.competitions', 'people.athletes'] },
      { id: 'disciplines', label: 'Sports & disciplines', pools: ['sports.disciplines'] },
      { id: 'competitions', label: 'Competitions & tournaments', pools: ['sports.competitions'] },
      { id: 'athletes', label: 'Athletes', pools: ['people.athletes'] },
    ],
  },
  {
    id: 'wars',
    label: 'Wars',
    icon: 'flag',
    accent: { light: '#C23B5B', dark: '#FF7896' },
    filters: ['country', 'era', 'obscurity'],
    yearMeaning: 'started',
    countryMeaning: 'Country or participant',
    subcategories: [
      { id: 'all', label: 'All conflicts', pools: ['wars.wars', 'wars.battles'] },
      { id: 'wars', label: 'Wars', pools: ['wars.wars'] },
      { id: 'battles', label: 'Battles', pools: ['wars.battles'] },
    ],
  },
];

export function getCategory(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category ${id}`);
  return found;
}

export function getSubcategory(category: Category, subId: string | undefined): Subcategory | undefined {
  return category.subcategories.find((s) => s.id === subId) ?? category.subcategories[0];
}
