
import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, RecipeCategory, RecipeTag, NutritionGoals, GeneratedRecipeData, Settings, MealPlan, PlannedMeal, MealType } from "../types";

if (!process.env.API_KEY) {
    // A default key is provided for development, but it's best to use an environment variable.
    console.warn("API_KEY environment variable is not set. Using a placeholder. This may fail.");
}

// Fix: Always use new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
// Fix: Use a recommended model
const model = "gemini-2.5-flash";

const parseJsonGracefully = <T>(jsonString: string): T | null => {
    try {
        // The response might have markdown ```json ... ``` wrapper
        const match = /```json\n([\s\S]*)\n```/.exec(jsonString);
        if (match) {
            return JSON.parse(match[1]);
        }
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to parse JSON:", jsonString, error);
        return null;
    }
}

export const analyzeRecipeWithGemini = async (
    recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>
): Promise<Pick<Recipe, 'macros' | 'healthScore' | 'scoreReasoning'>> => {
    const prompt = `
        Analyze the following recipe and return its nutritional information (macros), a health score (1-10), and a brief reasoning for the score.
        Recipe Name: ${recipe.name}
        Ingredients:
        ${recipe.ingredients}
        Instructions:
        ${recipe.instructions}

        Provide the output in JSON format with the following structure:
        {
            "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
            "healthScore": number (1-10, can be a float),
            "scoreReasoning": "string"
        }
        The macros should be for a single serving. Assume the ingredients list makes a reasonable number of servings if not specified.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    macros: {
                        type: Type.OBJECT,
                        properties: {
                            calories: { type: Type.NUMBER },
                            protein: { type: Type.NUMBER },
                            carbs: { type: Type.NUMBER },
                            fat: { type: Type.NUMBER },
                        },
                        required: ["calories", "protein", "carbs", "fat"],
                    },
                    healthScore: { type: Type.NUMBER },
                    scoreReasoning: { type: Type.STRING },
                },
                required: ["macros", "healthScore", "scoreReasoning"],
            },
        },
    });

    const result = parseJsonGracefully<{ macros: { calories: number; protein: number; carbs: number; fat: number; }; healthScore: number; scoreReasoning: string; }>(response.text);
    if (!result) {
        throw new Error("AI response was not valid JSON.");
    }

    return result;
};


export const generateShoppingListWithGemini = async (allIngredients: string): Promise<{ category: string; items: string[] }[]> => {
    const prompt = `
        Given the following list of ingredients from multiple recipes, create a categorized shopping list.
        Combine similar items (e.g., "1 cup flour" and "2 cups flour" should become "flour").
        Do not include quantities. Group the items into logical supermarket categories (e.g., "Produce", "Dairy & Eggs", "Meat & Seafood", "Pantry", "Bakery", "Spices").

        Ingredients List:
        ---
        ${allIngredients}
        ---

        Return the result as a JSON array of objects, where each object has a "category" and an "items" array.
        Example format:
        [
            { "category": "Produce", "items": ["onion", "garlic", "bell pepper"] },
            { "category": "Dairy & Eggs", "items": ["eggs", "milk", "cheddar cheese"] }
        ]
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        items: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["category", "items"],
                }
            }
        }
    });

    const result = parseJsonGracefully<{ category: string; items: string[] }[]>(response.text);

    if (!result) {
        throw new Error("AI response for shopping list was not valid JSON.");
    }
    return result;
};

export const parseRecipeFromTextWithGemini = async (text: string, availableTags: RecipeTag[]): Promise<GeneratedRecipeData> => {
    const prompt = `
        Extract recipe information from the following text. The text is likely scraped from a webpage.
        Identify the recipe name, ingredients (as a single string with newlines), and instructions (as a single string with newlines).
        Also, based on the recipe, suggest a few relevant tags from the provided list.

        Available Tags: ${availableTags.join(', ')}

        Text to parse:
        ---
        ${text.substring(0, 15000)}
        ---

        Return the result in JSON format with the following structure:
        {
            "name": "string",
            "ingredients": "string (newline-separated)",
            "instructions": "string (newline-separated)",
            "tags": ["string"],
            "category": "string"
        }
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) }
                },
                required: ["name", "ingredients", "instructions", "tags", "category"],
            }
        }
    });

    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) {
        throw new Error("AI could not parse recipe from text.");
    }

    return result;
};

export const suggestNutritionGoalsWithGemini = async (
    gender: 'male' | 'female',
    age: number,
    height: number,
    weight: number,
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
): Promise<NutritionGoals> => {
    const prompt = `
        Calculate estimated daily caloric needs and suggest macronutrient percentages (protein, carbs, fat) for a person with the following characteristics for weight maintenance.
        - Gender: ${gender}
        - Age: ${age} years
        - Height: ${height} cm
        - Weight: ${weight} kg
        - Activity Level: ${activityLevel}

        Return a JSON object with "calories" (number), "protein" (percentage), "carbs" (percentage), and "fat" (percentage).
        The percentages should sum to 100. A balanced diet is preferred (e.g., 30% protein, 40% carbs, 30% fat).
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                },
                required: ["calories", "protein", "carbs", "fat"],
            }
        }
    });

    const result = parseJsonGracefully<NutritionGoals>(response.text);
    if (!result) {
        throw new Error("AI could not suggest nutrition goals.");
    }

    return result;
};

export const generateRecipeFromIdeaWithGemini = async (
    idea: string,
    category: RecipeCategory,
    availableTags: RecipeTag[]
): Promise<GeneratedRecipeData> => {
    const prompt = `
        Create a recipe based on the following idea: "${idea}".
        The recipe should be for the "${category}" category.
        Provide a creative name, a list of ingredients (newline-separated string), and step-by-step instructions (newline-separated string).
        Also, suggest a few relevant tags from the provided list.

        Available Tags: ${availableTags.join(', ')}

        Return a JSON object with "name", "ingredients", "instructions", "category", and "tags".
    `;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["name", "ingredients", "instructions", "category", "tags"],
            }
        }
    });

    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) {
        throw new Error("AI could not generate a recipe from the idea.");
    }
    return result;
};

export const generateMealPlanWithGemini = async (
    settings: Settings,
    allRecipes: Recipe[],
): Promise<MealPlan> => {

    const recipesString = JSON.stringify(
        allRecipes.map(r => ({ 
            id: r.id, 
            name: r.name, 
            category: r.category, 
            tags: r.tags, 
            macros: r.macros,
            rating: r.rating,
        }))
    );

    const prompt = `
        You are a meal planning expert. Create a ${settings.planDurationWeeks}-week meal plan based on the user's settings and available recipes.
        
        Settings:
        - Number of People: ${settings.numberOfPeople}
        - Meals per week:
            - Weekday Breakfasts: ${settings.mealsPerWeek.weekdayBreakfasts}
            - Weekend Breakfasts: ${settings.mealsPerWeek.weekendBreakfasts}
            - Weekday Dinners: ${settings.mealsPerWeek.weekdayDinners}
            - Weekend Dinners: ${settings.mealsPerWeek.weekendDinners}
            - Weekday Snacks: ${settings.mealsPerWeek.weekdaySnacks}
            - Weekend Snacks: ${settings.mealsPerWeek.weekendSnacks}
        - Person 1 Goals: ${JSON.stringify(settings.people[0].goals)}
        - Dinner Servings: ${settings.servingsPerPerson} (if > 1, use leftovers for lunches)
        - Leftover Strategy: ${settings.leftoverStrategy}

        Generation Tags (use these to guide recipe selection):
        - Weekday Dinner: ${settings.generationTags.weekdayDinner.join(', ')}
        - Weekend Dinner: ${settings.generationTags.weekendDinner.join(', ')}
        - Weekday Breakfast: ${settings.generationTags.weekdayBreakfast.join(', ')}
        - Weekend Breakfast: ${settings.generationTags.weekendBreakfast.join(', ')}
        - Weekday Snack: ${settings.generationTags.weekdaySnack.join(', ')}
        - Weekend Snack: ${settings.generationTags.weekendSnack.join(', ')}

        Available Recipes (JSON format):
        ${recipesString.substring(0, 20000)}

        RULES:
        1. Start the plan from tomorrow's date. Today is ${new Date().toISOString().split('T')[0]}.
        2. Adhere to the number of meals per week specified in the settings.
        3. Prioritize recipes with higher ratings.
        4. Use the "Generation Tags" to select appropriate meals (e.g., use 'easy to cook' recipes for weekday dinners).
        5. For dinners, if 'servingsPerPerson' is > 1, use the same dinner recipe for a lunch according to the 'leftoverStrategy'. If strategy is 'random', place it on any subsequent day that needs a lunch. If 'next_day', place it on the following day's lunch.
        6. Create a varied plan, avoiding repeating the same meal too often within the same week.
        7. Try to meet the nutritional goals for the people, especially Person 1.
        8. The output MUST be a valid JSON object. The keys should be date strings in "YYYY-MM-DD" format, and the values should be objects containing the recipe ID for "breakfast", "lunch", "dinner", and/or "snack".
        
        Example Output Format:
        {
            "2024-08-15": { "breakfast": "recipe-id-1", "lunch": "recipe-id-2", "dinner": "recipe-id-3" },
            "2024-08-16": { "breakfast": "recipe-id-4", "lunch": "recipe-id-3", "snack": "recipe-id-5" } 
        }
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    
    const result = parseJsonGracefully<Record<string, { [key in MealType]?: string }>>(response.text);

    if (!result) {
        throw new Error("AI could not generate a valid meal plan.");
    }
    
    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
    const newMealPlan: MealPlan = new Map();

    for (const [dateString, dayPlanIds] of Object.entries(result)) {
        const plannedDay: PlannedMeal = {};
        if (dayPlanIds.breakfast) plannedDay.breakfast = recipeMap.get(dayPlanIds.breakfast);
        if (dayPlanIds.lunch) plannedDay.lunch = recipeMap.get(dayPlanIds.lunch);
        if (dayPlanIds.dinner) plannedDay.dinner = recipeMap.get(dayPlanIds.dinner);
        if (dayPlanIds.snack) plannedDay.snack = recipeMap.get(dayPlanIds.snack);
        newMealPlan.set(dateString, plannedDay);
    }
    
    return newMealPlan;
};
