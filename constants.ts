import { Tab, RecipeTag, RecipeCategory, Settings } from './types';

export const TABS: Tab[] = [
  { id: 'planner', label: 'Planner' },
  { id: 'shopping', label: 'Shopping List' },
  { id: 'meals', label: 'Meals' },
  { id: 'log', label: 'Log' },
  { id: 'settings', label: 'Settings' },
];

export const DEFAULT_DINNER_TAGS: RecipeTag[] = ['affordable', 'high protein', 'low cal', 'high cal', 'premium', 'easy to cook', 'longer to cook'];
export const DEFAULT_SNACK_TAGS: RecipeTag[] = ['on-the-go', 'microwave', 'needs prepared'];
export const DEFAULT_BREAKFAST_TAGS: RecipeTag[] = [...DEFAULT_DINNER_TAGS, 'microwave', 'on-the-go'];

export const DEFAULT_ALL_TAGS: Record<RecipeCategory, RecipeTag[]> = {
    [RecipeCategory.Dinner]: DEFAULT_DINNER_TAGS,
    [RecipeCategory.Snack]: DEFAULT_SNACK_TAGS,
    [RecipeCategory.Breakfast]: DEFAULT_BREAKFAST_TAGS,
};

export const DEFAULT_SETTINGS: Settings = {
    planDurationWeeks: 1,
    numberOfPeople: 2,
    servingsPerPerson: 2,
    leftoverStrategy: 'random',
    mealsPerWeek: {
        weekdayBreakfasts: 5,
        weekendBreakfasts: 2,
        weekdayDinners: 5,
        weekendDinners: 1,
        weekdaySnacks: 5,
        weekendSnacks: 2,
    },
    generationTags: {
       weekendDinner: ['premium', 'longer to cook'],
       weekdayDinner: ['easy to cook', 'affordable'],
       weekendBreakfast: ['longer to cook'],
       weekdayBreakfast: ['on-the-go', 'easy to cook'],
       weekdaySnack: ['on-the-go', 'microwave'],
       weekendSnack: ['needs prepared'],
    },
    people: [
        { name: 'Person 1', goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } },
        { name: 'Person 2', goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } },
    ]
};