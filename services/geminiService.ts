

import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, RecipeCategory, RecipeTag, NutritionGoals, GeneratedRecipeData, Settings, MealPlan, PlannedMeal, MealType, BulkParsedRecipe } from "../types";
import { DEFAULT_ALL_TAGS } from "../constants";

if (!process.env.API_KEY) {
    // A default key is provided for development, but it's best to use an environment variable.
    console.warn("API_KEY environment variable is not set. Using a placeholder. This may fail.");
}

// Fix: Always use new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
// Fix: Use a recommended model. Upgraded to Pro for more complex tasks.
const model = "gemini-2.5-pro";

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

// Helper function to convert a browser File object to a Gemini GenerativePart.
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type
    }
  };
};

export const analyzeRecipeWithGemini = async (
    recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>
): Promise<Pick<Recipe, 'macros' | 'healthScore' | 'scoreReasoning' | 'servings'>> => {
    const prompt = `
        Analyze the following recipe and return its nutritional information (macros), a health score (1-10), a brief reasoning for the score, and the number of servings it makes.
        Recipe Name: ${recipe.name}
        Ingredients:
        ${recipe.ingredients}
        Instructions:
        ${recipe.instructions}

        Provide the output in JSON format with the following structure:
        {
            "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
            "healthScore": number (1-10, can be a float),
            "scoreReasoning": "string",
            "servings": number
        }
        The macros should be for a single serving.
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
                    servings: { type: Type.NUMBER },
                },
                required: ["macros", "healthScore", "scoreReasoning", "servings"],
            },
        },
    });

    const result = parseJsonGracefully<Pick<Recipe, 'macros' | 'healthScore' | 'scoreReasoning' | 'servings'>>(response.text);
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

export const categorizeShoppingItemWithGemini = async (itemName: string): Promise<string> => {
    const prompt = `
        Categorize the grocery item "${itemName}" into a logical supermarket category (e.g., Produce, Dairy & Eggs, Meat & Seafood, Pantry, Bakery, Spices, Frozen, Beverages, Household, Other).
        Return a JSON object with a single key "category".
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Use flash for low latency
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING },
                },
                required: ["category"],
            }
        }
    });

    const result = parseJsonGracefully<{ category: string }>(response.text);
    return result?.category || "Other";
};

export const parseRecipeFromTextWithGemini = async (text: string, availableTags: RecipeTag[]): Promise<GeneratedRecipeData> => {
    const prompt = `
        Extract recipe information from the following text.
        Identify the recipe name, ingredients, instructions, and number of servings.
        Also, based on the recipe, suggest a few relevant tags from the provided list.

        Available Tags: ${availableTags.join(', ')}

        Text to parse:
        ---
        ${text.substring(0, 15000)}
        ---
        
        CRITICAL FORMATTING RULES:
        - The 'ingredients' and 'instructions' strings MUST have each item on a new line, separated by a '\\n' character.
        - DO NOT include markdown checkboxes like '- [ ]' in the ingredients or instructions.
        - DO NOT return ingredients or instructions as a single run-on sentence.

        Return the result in JSON format with the following structure:
        {
            "name": "string",
            "ingredients": "string (MUST be newline-separated)",
            "instructions": "string (MUST be newline-separated)",
            "tags": ["string"],
            "category": "string",
            "servings": number
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
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
                    servings: { type: Type.NUMBER },
                },
                required: ["name", "ingredients", "instructions", "tags", "category", "servings"],
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
    availableTags: RecipeTag[],
    blacklistedIngredients: string[]
): Promise<GeneratedRecipeData> => {
    let blacklistInstruction = '';
    if (blacklistedIngredients.length > 0) {
        blacklistInstruction = `CRITICAL RULE: DO NOT use any of the following ingredients in the recipe: ${blacklistedIngredients.join(', ')}.`;
    }

    const prompt = `
        Create a full recipe based on the following idea: "${idea}".
        The recipe should be for the "${category}" category.
        Provide a creative name, a list of ingredients, step-by-step instructions, and the number of servings this recipe makes.
        Also, suggest a few relevant tags from the provided list.

        Available Tags: ${availableTags.join(', ')}

        ${blacklistInstruction}

        CRITICAL FORMATTING RULES:
        - The 'ingredients' and 'instructions' strings MUST have each item on a new line, separated by a '\\n' character.
        - DO NOT include markdown checkboxes like '- [ ]' in the ingredients or instructions.
        - DO NOT return ingredients or instructions as a single run-on sentence.

        Return a JSON object with "name", "ingredients", "instructions", "category", "tags", and "servings".
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
                    },
                    servings: { type: Type.NUMBER },
                },
                required: ["name", "ingredients", "instructions", "category", "tags", "servings"],
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
    
    let blacklistInstruction = '';
    if (settings.blacklistedIngredients.length > 0) {
        blacklistInstruction = `8. CRITICAL: Avoid selecting recipes that contain these ingredients: ${settings.blacklistedIngredients.join(', ')}. You must adhere to this blacklist.`;
    }

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
        ${blacklistInstruction}
        9. The output MUST be a valid JSON object. The keys should be date strings in "YYYY-MM-DD" format, and the values should be objects containing the recipe ID for "breakfast", "lunch", "dinner", and/or "snack".
        
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

const bulkRecipeResponseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "The name of the recipe." },
            ingredients: { type: Type.STRING, description: "The full list of ingredients. CRITICAL: Each ingredient must be on a new line, separated by a '\\n' character." },
            instructions: { type: Type.STRING, description: "The cooking instructions. CRITICAL: Each step must be on a new line, separated by a '\\n' character." },
            category: { type: Type.STRING, enum: Object.values(RecipeCategory), description: "The recipe category." },
            tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Relevant tags from the provided list."
            },
            macros: {
                type: Type.OBJECT,
                properties: {
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                },
                required: ["calories", "protein", "carbs", "fat"],
                description: "Nutritional information for a single serving."
            },
            healthScore: { type: Type.NUMBER, description: "A health score from 1 to 10." },
            scoreReasoning: { type: Type.STRING, description: "A brief reason for the health score." },
            servings: { type: Type.NUMBER, description: "The number of servings this recipe makes." },
        },
        required: ["name", "ingredients", "instructions", "category", "tags", "macros", "healthScore", "scoreReasoning", "servings"],
    }
};

export const bulkParseRecipesFromFileWithGemini = async (file: File, availableTags: RecipeTag[], blacklistedIngredients: string[]): Promise<BulkParsedRecipe[]> => {
    const filePart = await fileToGenerativePart(file);

    let blacklistInstruction = '';
    if (blacklistedIngredients.length > 0) {
        blacklistInstruction = `CRITICAL RULE: If any recipe contains one of the following ingredients, DO NOT include it in your output: ${blacklistedIngredients.join(', ')}.`;
    }

    const prompt = `
        You are an expert recipe parser. Analyze the attached file (${file.name}) which contains one or more recipes.
        The file could be a text document, a PDF with text, or even a scanned PDF with images of recipes.
        Your task is to extract every complete recipe you find into a structured JSON object.

        For each recipe, you must identify:
        1. The name.
        2. The ingredients.
        3. The instructions.
        4. A suitable category from this list: ${Object.values(RecipeCategory).join(', ')}.
        5. A few relevant tags for each recipe from this list: ${availableTags.join(', ')}.
        6. An estimated nutritional analysis for a single serving (macros).
        7. A health score from 1 to 10 and a brief reasoning.
        8. The number of servings the recipe makes.

        ${blacklistInstruction}

        CRITICAL FORMATTING RULES:
        - The 'ingredients' and 'instructions' strings MUST have each item on a new line, separated by a '\\n' character.
        - DO NOT include markdown checkboxes like '- [ ]' in the ingredients or instructions.
        - DO NOT use commas or run-on sentences for lists.

        Return the result as a single JSON array, where each element is a recipe object.
        Only include full recipes with ingredients and instructions. Ignore any partial recipes or non-recipe text.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: [ { parts: [ { text: prompt } ] }, { parts: [ filePart ] } ],
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeResponseSchema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });

    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) {
        throw new Error("AI could not parse any recipes from the provided file.");
    }

    return result;
};


export const bulkGenerateAndAnalyzeRecipesWithGemini = async (ideas: string[], category: RecipeCategory, availableTags: RecipeTag[], blacklistedIngredients: string[]): Promise<BulkParsedRecipe[]> => {
    let blacklistInstruction = '';
    if (blacklistedIngredients.length > 0) {
        blacklistInstruction = `CRITICAL RULE: DO NOT use any of the following ingredients in the recipes you generate: ${blacklistedIngredients.join(', ')}.`;
    }
    
    const prompt = `
        For each of the following meal ideas, generate a full recipe.
        
        Meal Ideas:
        - ${ideas.join('\n- ')}

        For each generated recipe, you must provide:
        1. A creative name.
        2. A list of ingredients.
        3. Step-by-step instructions.
        4. The category should be "${category}".
        5. A few relevant tags from this list: ${availableTags.join(', ')}.
        6. An estimated nutritional analysis for a single serving (macros).
        7. A health score from 1 to 10 and a brief reasoning.
        8. The number of servings the recipe makes.
        
        ${blacklistInstruction}

        CRITICAL FORMATTING RULES:
        - The 'ingredients' and 'instructions' strings MUST have each item on a new line, separated by a '\\n' character.
        - DO NOT include markdown checkboxes like '- [ ]' in the ingredients or instructions.
        - DO NOT use commas or run-on sentences for lists.

        Return the result as a single JSON array, where each element is a recipe object corresponding to one of the ideas.
    `;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeResponseSchema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });

    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) {
        throw new Error("AI could not generate recipes from the ideas.");
    }
    
    return result;
}

const singleRecipeSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the recipe." },
        ingredients: { type: Type.STRING, description: "The full list of ingredients. CRITICAL: Each ingredient must be on a new line, separated by a '\\n' character." },
        instructions: { type: Type.STRING, description: "The cooking instructions. CRITICAL: Each step must be on a new line, separated by a '\\n' character." },
        category: { type: Type.STRING, enum: Object.values(RecipeCategory), description: "The recipe category." },
        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Relevant tags from the provided list."
        },
        macros: {
            type: Type.OBJECT,
            properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
            },
            required: ["calories", "protein", "carbs", "fat"],
            description: "Nutritional information for a single serving."
        },
        healthScore: { type: Type.NUMBER, description: "A health score from 1 to 10." },
        scoreReasoning: { type: Type.STRING, description: "A brief reason for the health score." },
        servings: { type: Type.NUMBER, description: "The number of servings this recipe now makes." },
    },
    required: ["name", "ingredients", "instructions", "category", "tags", "macros", "healthScore", "scoreReasoning", "servings"],
};

export const editRecipeWithGemini = async (
    originalRecipe: Recipe,
    editRequest: string,
    blacklistedIngredients: string[]
): Promise<BulkParsedRecipe> => {
    const allAvailableTags = new Set<string>();
    Object.values(RecipeCategory).forEach(cat => {
        (DEFAULT_ALL_TAGS[cat] || []).forEach(tag => allAvailableTags.add(tag));
    });

    let blacklistInstruction = '';
    if (blacklistedIngredients.length > 0) {
        blacklistInstruction = `CRITICAL RULE: DO NOT use or introduce any of the following ingredients: ${blacklistedIngredients.join(', ')}. If the original recipe contains one of these, you must try to substitute it with something appropriate.`;
    }

    const prompt = `
        You are an expert recipe editor. A user wants to modify an existing recipe.
        Apply the user's requested changes to the original recipe provided below.

        Original Recipe Name: ${originalRecipe.name}
        Original Servings: ${originalRecipe.servings}
        Original Ingredients:
        ${originalRecipe.ingredients}
        Original Instructions:
        ${originalRecipe.instructions}

        User's Edit Request: "${editRequest}"

        Your task is to:
        1.  Modify the recipe's name, ingredients, instructions, and servings based on the request. For example, if they ask for more servings, adjust ingredient quantities and update the 'servings' field. If they ask to substitute an ingredient, update it in both the ingredients list and instructions.
        2.  Re-analyze the *new* recipe to provide an estimated nutritional analysis (macros) for a single serving.
        3.  Provide a new health score (1-10) and a brief reasoning for the new version.
        4.  Suggest relevant tags from this list: ${Array.from(allAvailableTags).join(', ')}.
        5.  Assign a category. The original category was "${originalRecipe.category}". Change it only if the edit makes it necessary.
        
        ${blacklistInstruction}

        CRITICAL FORMATTING RULES:
        - The 'ingredients' and 'instructions' strings MUST have each item on a new line, separated by a '\\n' character.
        - DO NOT include markdown checkboxes like '- [ ]' in the ingredients or instructions.

        Return a single JSON object with the updated recipe details.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: singleRecipeSchema
        }
    });

    const result = parseJsonGracefully<BulkParsedRecipe>(response.text);
    if (!result) {
        throw new Error("AI could not edit the recipe.");
    }

    return result;
};

export const checkForDuplicatesWithGemini = async (
    newRecipe: Omit<Recipe, 'id' | 'rating' | 'macros' | 'healthScore' | 'scoreReasoning'>,
    existingRecipes: Recipe[]
): Promise<{ isDuplicate: boolean; similarRecipeName: string | null; reasoning: string }> => {
    if (existingRecipes.length === 0) {
        return { isDuplicate: false, similarRecipeName: null, reasoning: "No existing recipes to compare against." };
    }

    const existingRecipeNames = existingRecipes.map(r => r.name).join('; ');

    const prompt = `
        You are a meticulous recipe duplicate detector. Your task is to determine if a new recipe is a duplicate of an existing one. Be very strict. Only flag a recipe as a duplicate if it is almost identical.

        CRITERIA FOR NOT BEING A DUPLICATE:
        - If the recipe names are significantly different (e.g., "Spicy Chicken Tacos" vs. "Easy Beef Burritos").
        - If the primary protein source is different (e.g., chicken vs. beef, tofu vs. fish).
        - If the core ingredients or cooking method are fundamentally different.

        A recipe IS a duplicate ONLY IF:
        - It has a very similar name AND the ingredients list is substantially the same, even with minor variations in quantity or wording (e.g., "Grandma's Chicken Soup" vs. "Classic Chicken Noodle Soup" with the same ingredients).

        New Recipe Name: ${newRecipe.name}
        New Recipe Ingredients:
        ${newRecipe.ingredients}

        List of Existing Recipe Names:
        ${existingRecipeNames.substring(0, 10000)}

        Is the new recipe a duplicate of any in the existing list?
        Return your answer as a JSON object with this exact structure:
        {
          "isDuplicate": boolean,
          "similarRecipeName": "string" | null (the name of the most similar existing recipe if it's a duplicate, otherwise null),
          "reasoning": "string" (a brief explanation for your decision)
        }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Use flash for this simpler, faster task
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN },
                    similarRecipeName: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                },
                required: ["isDuplicate", "similarRecipeName", "reasoning"],
            },
        },
    });

    const result = parseJsonGracefully<{ isDuplicate: boolean; similarRecipeName: string | null; reasoning: string }>(response.text);
    if (!result) {
        // Default to not a duplicate if AI fails
        return { isDuplicate: false, similarRecipeName: null, reasoning: "AI analysis failed." };
    }

    return result;
};

export const generateShoppingAgentInstructions = async (
    store: string,
    service: string,
    datetime: string,
    items: string[],
    goalsDescription: string
): Promise<string> => {
    const prompt = `
        Write a clear, detailed, and precise instruction for an autonomous AI Agent that operates a web browser.
        The user wants the agent to shop for groceries.

        **Task Details:**
        - **Store:** ${store}
        - **Service Type:** ${service}
        - **Timing:** ${datetime}
        - **Shopping List:**
          ${items.map(i => `- ${i}`).join('\n')}

        **Agent Constraints & Preferences:**
        - **Price Sensitivity:** Low-Medium (look for value/sales).
        - **Health Focus:** Medium-High (prioritize healthier options).
        - **Household Health Goals:** ${goalsDescription}.
        - **Recipe Context:** The items are for specific recipes matching these goals.

        **Agent Execution Workflow (Must be included in instructions):**
        1. Navigate to the grocery store website.
        2. **CRITICAL STEP:** Check if the user is logged in. If not, explicitly instruct the user to log in and PAUSE until they confirm they are logged in. Do not proceed until logged in.
        3. Search for and add the listed items to the cart. When selecting specific products, use the Price and Health constraints to make the best choice.
        4. Navigate to checkout/cart.
        5. Select the specified Service Type (${service}) and Time (${datetime}).
        6. **CRITICAL STEP:** Display the final cart to the user with the delivery/pickup details selected.
        7. **PAUSE** and ask the user for confirmation.
        8. Allow the user to either:
           - Confirm and pay manually.
           - Instruct the Agent to make changes (add/remove items, change time).
           - Do NOT finalize payment automatically unless explicitly authorized by a subsequent user command (though usually the user will pay manually).

        **Output Format:**
        Return ONLY the instruction text for the Agent. Do not include conversational filler like "Here is your instruction". Start directly with "Act as an autonomous shopping agent..."
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });

    return response.text;
}