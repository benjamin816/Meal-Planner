
import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, RecipeCategory, RecipeTag, NutritionGoals, GeneratedRecipeData, Settings, MealPlan, PlannedMeal, MealType, BulkParsedRecipe } from "../types";
import { DEFAULT_ALL_TAGS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

const parseJsonGracefully = <T>(jsonString: string): T | null => {
    try {
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
        model: FLASH_MODEL,
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
    `;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
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
        Categorize the grocery item "${itemName}" into a logical supermarket category.
        Return a JSON object with a single key "category".
    `;

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
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
        Also, suggest relevant tags from: ${availableTags.join(', ')}

        Text:
        ---
        ${text.substring(0, 15000)}
        ---
        
        CRITICAL: Each ingredient/instruction step must be on a new line (\n).
        Return JSON structure: { name, ingredients, instructions, tags, category, servings }
    `;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
                    servings: { type: Type.NUMBER },
                },
                required: ["name", "ingredients", "instructions", "tags", "category", "servings"],
            }
        }
    });

    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("AI could not parse recipe from text.");
    return result;
};

export const suggestNutritionGoalsWithGemini = async (
    gender: 'male' | 'female', age: number, height: number, weight: number, activityLevel: string
): Promise<NutritionGoals> => {
    const prompt = `
        Calculate daily caloric needs and macronutrient percentages for: ${gender}, ${age}y, ${height}cm, ${weight}kg, Activity: ${activityLevel}.
        Return JSON: { calories, protein, carbs, fat }
    `;

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
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
    if (!result) throw new Error("AI could not suggest nutrition goals.");
    return result;
};

export const generateRecipeFromIdeaWithGemini = async (
    idea: string, category: RecipeCategory, availableTags: RecipeTag[], blacklistedIngredients: string[]
): Promise<GeneratedRecipeData> => {
    const blacklist = blacklistedIngredients.length > 0 ? `DO NOT USE: ${blacklistedIngredients.join(', ')}.` : '';
    const prompt = `
        Create a recipe for "${idea}" in "${category}".
        Tags: ${availableTags.join(', ')}
        ${blacklist}
        Ingredients/Instructions: \n separated.
        Return JSON: { name, ingredients, instructions, category, tags, servings }
    `;
    const response = await ai.models.generateContent({
        model: PRO_MODEL,
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
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    servings: { type: Type.NUMBER },
                },
                required: ["name", "ingredients", "instructions", "category", "tags", "servings"],
            }
        }
    });

    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("AI could not generate a recipe from idea.");
    return result;
};

const bulkRecipeResponseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            ingredients: { type: Type.STRING },
            instructions: { type: Type.STRING },
            category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        required: ["name", "ingredients", "instructions", "category", "tags", "macros", "healthScore", "scoreReasoning", "servings"],
    }
};

export const bulkParseRecipesFromFileWithGemini = async (
    file: File, 
    availableTags: RecipeTag[], 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const filePart = await fileToGenerativePart(file);
    const blacklist = blacklistedIngredients.length > 0 ? `DO NOT INCLUDE recipes with: ${blacklistedIngredients.join(', ')}.` : '';

    const prompt = `
        Analyze the attached file and extract EVERY recipe. 
        CRITICAL REQUIREMENTS:
        1. MANDATORY SERVINGS: Scale all ingredient quantities so each recipe makes EXACTLY ${targetServings} servings.
        2. NUTRITION GUIDANCE: Note user goals (${JSON.stringify(nutritionGoals)}) to ensure macro estimates are accurate.
        3. ${blacklist}
        4. Extract ALL recipes, do not skip any.
        5. Formatting: Ingredients/Instructions MUST be \n separated.
        
        Return a JSON array of objects.
    `;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: [ { parts: [ { text: prompt } ] }, { parts: [ filePart ] } ],
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeResponseSchema,
            maxOutputTokens: 20000,
            thinkingConfig: { thinkingBudget: 4000 },
        },
    });

    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) throw new Error("AI could not parse recipes from file.");
    return result;
};

export const bulkGenerateAndAnalyzeRecipesWithGemini = async (
    ideas: string[], 
    category: RecipeCategory, 
    availableTags: RecipeTag[], 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const blacklist = blacklistedIngredients.length > 0 ? `DO NOT USE: ${blacklistedIngredients.join(', ')}.` : '';
    
    const prompt = `
        Generate ${ideas.length} full recipes for these ideas:
        ${ideas.join('\n')}

        CRITICAL CONSTRAINTS:
        1. SERVINGS: Each recipe MUST be formulated for EXACTLY ${targetServings} servings. Calculate ingredient amounts accordingly.
        2. HEALTH GOALS: Adhere to user goals (${JSON.stringify(nutritionGoals)}). Favor ingredients that align with these macros.
        3. CATEGORY: All must be "${category}".
        4. TAGS: Use from ${availableTags.join(', ')}.
        5. ${blacklist}
        
        Return a JSON array.
    `;
    
    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeResponseSchema,
            maxOutputTokens: 20000,
            thinkingConfig: { thinkingBudget: 4000 },
        },
    });

    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) throw new Error("AI could not generate recipes from ideas.");
    return result;
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

    const blacklist = blacklistedIngredients.length > 0 ? `DO NOT USE: ${blacklistedIngredients.join(', ')}.` : '';

    const prompt = `
        Edit this recipe: ${JSON.stringify(originalRecipe)}
        Request: "${editRequest}"
        ${blacklist}
        Re-analyze macros, health score, and suggest tags.
        Return a single JSON object.
    `;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: bulkRecipeResponseSchema.items.properties,
                required: bulkRecipeResponseSchema.items.required,
            }
        }
    });

    const result = parseJsonGracefully<BulkParsedRecipe>(response.text);
    if (!result) throw new Error("AI could not edit the recipe.");
    return result;
};

export const checkForDuplicatesWithGemini = async (
    newRecipe: Omit<Recipe, 'id' | 'rating' | 'macros' | 'healthScore' | 'scoreReasoning'>,
    existingRecipes: Recipe[]
): Promise<{ isDuplicate: boolean; similarRecipeName: string | null; reasoning: string }> => {
    if (existingRecipes.length === 0) return { isDuplicate: false, similarRecipeName: null, reasoning: "" };
    const names = existingRecipes.map(r => r.name).join('; ');
    const prompt = `Check if "${newRecipe.name}" is a duplicate of: ${names.substring(0, 10000)}. Return JSON.`;

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
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
    return result || { isDuplicate: false, similarRecipeName: null, reasoning: "" };
};

export const generateShoppingAgentInstructions = async (
    store: string, service: string, datetime: string, items: string[], goalsDescription: string
): Promise<string> => {
    const prompt = `Write agent instructions for shopping at ${store} (${service}) at ${datetime}. List: ${items.join(', ')}. Goals: ${goalsDescription}.`;
    const response = await ai.models.generateContent({ model: PRO_MODEL, contents: prompt });
    return response.text;
}

// Fix: Implement missing generateMealPlanWithGemini function to select recipes for a given duration.
export const generateMealPlanWithGemini = async (settings: Settings, recipes: Recipe[]): Promise<MealPlan> => {
    const recipeOptions = recipes.map(r => ({ id: r.id, name: r.name, category: r.category, tags: r.tags }));
    const prompt = `
        Generate a healthy meal plan for ${settings.planDurationWeeks} week(s).
        Settings: ${JSON.stringify(settings)}
        Available Recipes: ${JSON.stringify(recipeOptions)}

        Return a JSON array where each object represents one day, including:
        - "date": string (YYYY-MM-DD)
        - "breakfastId": string (selected recipe ID)
        - "lunchId": string (selected recipe ID, typically a leftover dinner)
        - "dinnerId": string (selected recipe ID)
        - "snackId": string (selected recipe ID)

        Ensure recipe categories and tags match the settings requirements for weekdays/weekends.
    `;

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        breakfastId: { type: Type.STRING },
                        lunchId: { type: Type.STRING },
                        dinnerId: { type: Type.STRING },
                        snackId: { type: Type.STRING },
                    },
                    required: ["date"],
                }
            }
        }
    });

    const parsedPlan = parseJsonGracefully<any[]>(response.text);
    const plan: MealPlan = new Map();

    if (parsedPlan) {
        parsedPlan.forEach(day => {
            const plannedDay: PlannedMeal = {
                breakfast: recipes.find(r => r.id === day.breakfastId),
                lunch: recipes.find(r => r.id === day.lunchId),
                dinner: recipes.find(r => r.id === day.dinnerId),
                snack: recipes.find(r => r.id === day.snackId),
            };
            plan.set(day.date, plannedDay);
        });
    }

    return plan;
};
