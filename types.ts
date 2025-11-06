
export interface Tab {
  id: 'planner' | 'shopping' | 'meals' | 'log' | 'settings';
  label: string;
}

export type RecipeTag = string;

export enum RecipeCategory {
  Breakfast = 'Breakfast',
  Dinner = 'Dinner',
  Snack = 'Snack',
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Person {
  name: string;
  goals: NutritionGoals;
}

export interface Settings {
  planDurationWeeks: number;
  numberOfPeople: number;
  servingsPerPerson: number;
  leftoverStrategy: 'next_day' | 'day_after' | 'random';
  mealsPerWeek: {
    weekdayBreakfasts: number;
    weekendBreakfasts: number;
    weekdayDinners: number;
    weekendDinners: number;
    weekdaySnacks: number;
    weekendSnacks: number;
  };
  generationTags: {
    weekendDinner: RecipeTag[];
    weekdayDinner: RecipeTag[];
    weekendBreakfast: RecipeTag[];
    weekdayBreakfast: RecipeTag[];
    weekdaySnack: RecipeTag[];
    weekendSnack: RecipeTag[];
  };
  people: Person[];
}

export interface Recipe {
    id: string;
    name: string;
    category: RecipeCategory;
    tags: RecipeTag[];
    ingredients: string;
    instructions: string;
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    healthScore: number;
    scoreReasoning: string;
    rating: number;
    isAlsoBreakfast?: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMeal {
    breakfast?: Recipe;
    lunch?: Recipe;
    dinner?: Recipe;
    snack?: Recipe;
}

export type MealPlan = Map<string, PlannedMeal>; // Key is YYYY-MM-DD date string

export type EatenLog = Map<string, Partial<Record<MealType, boolean>>>; // Key is YYYY-MM-DD date string

export interface GeneratedRecipeData {
    name: string;
    ingredients: string;
    instructions: string;
    category: RecipeCategory;
    tags: RecipeTag[];
}
