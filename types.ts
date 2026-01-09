
export interface Tab {
  id: 'planner' | 'shopping' | 'meals' | 'log' | 'settings';
  label: string;
}

export enum RecipeCategory {
  Breakfast = 'Breakfast',
  Dinner = 'Dinner',
  Snack = 'Snack',
  Drink = 'Drink',
}

export type UsageIntensity = 'light' | 'normal' | 'heavy';

export type RecipeTag = 'affordable' | 'high protein' | 'low cal' | 'high cal' | 'premium' | 'easy to cook' | 'longer to cook' | 'on-the-go' | 'microwave' | 'needs prepared';

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

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DaySettings {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack: boolean;
}

export interface Settings {
  planDurationWeeks: number;
  numberOfPeople: number;
  useLeftoverForLunch: boolean;
  autoAdjustPortions: boolean;
  fudgeRoom: number;
  minMealGapDays: number;
  dinnersPerWeek: number;
  breakfastsPerWeek: number;
  snacksPerWeek: number;
  lunchesPerWeek: number;
  defaultDrinksPerPersonPerDay: number;
  maxUsesPerRecipePerPlan: number;
  leftoverStrategy: 'next_day' | 'day_after' | 'random';
  dailyMeals: Record<DayOfWeek, DaySettings>;
  people: Person[];
  blacklistedIngredients: string[];
}

export interface Recipe {
    id: string;
    name: string;
    description?: string;
    category: RecipeCategory;
    ingredients: string;
    instructions: string;
    tags: RecipeTag[];
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    healthScore: number;
    scoreReasoning: string;
    usageIntensity: UsageIntensity; 
    servings: number; 
    isAlsoBreakfast?: boolean;
    isAlsoSnack?: boolean;
    isDefaultDrink?: boolean;
    baseRecipeId?: string;
    variationName?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'drink';

export interface PlannedMeal {
    breakfast?: Recipe;
    breakfastPortions?: number[]; // One per person
    lunch?: Recipe;
    lunchPortions?: number[]; // One per person
    dinner?: Recipe;
    dinnerPortions?: number[]; // One per person
    snack?: Recipe;
    snackPortions?: number[]; // One per person
    drink?: Recipe;
    drinkQuantity?: number; // per person
    isMealPrepDay?: boolean;
}

export type MealPlan = Map<string, PlannedMeal>;

export type EatenLog = Map<string, Partial<Record<MealType, boolean>>>;

export interface GeneratedRecipeData {
    name: string;
    description?: string;
    ingredients: string;
    instructions: string;
    category: RecipeCategory;
    servings: number;
    isAlsoBreakfast?: boolean;
    isAlsoSnack?: boolean;
    usageIntensity?: UsageIntensity;
}

export interface BulkParsedRecipe {
    name: string;
    description?: string;
    ingredients: string;
    instructions: string;
    category: RecipeCategory;
    tags: RecipeTag[];
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    healthScore: number;
    scoreReasoning: string;
    usageIntensity: UsageIntensity;
    servings: number;
    isAlsoBreakfast?: boolean;
    isAlsoSnack?: boolean;
}

export interface ShoppingListItem {
    id: string;
    name: string;
    checked: boolean;
}

export interface ShoppingListCategory {
    id: string;
    name: string;
    items: ShoppingListItem[];
}

export interface SimilarityGroup {
    primaryRecipeId: string;
    similarRecipeIds: string[];
    reasoning: string;
}

// New types for Batch Prep Workflow
export interface PrepWorkflowStep {
    title: string;
    description: string;
    estimatedMinutes: number;
    type: 'setup' | 'prep' | 'cooking' | 'storage';
}

export interface PrepWorkflow {
    requiredIngredients: string[];
    steps: PrepWorkflowStep[];
}
