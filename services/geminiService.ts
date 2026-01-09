import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Recipe, RecipeCategory, NutritionGoals, GeneratedRecipeData, Settings, MealPlan, PlannedMeal, MealType, BulkParsedRecipe, UsageIntensity, SimilarityGroup, PrepWorkflow } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

/**
 * Helper to wrap API calls with exponential backoff for 429 errors
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let retries = 0;
    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
            if (isRateLimit && retries < maxRetries) {
                const delay = initialDelay * Math.pow(2, retries);
                console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
                continue;
            }
            throw error;
        }
    }
}

const parseJsonGracefully = <T>(jsonString: string): T | null => {
    try {
        let sanitized = jsonString.trim();
        const match = /```json\n([\s\S]*)\n```/.exec(sanitized);
        if (match) sanitized = match[1];
        
        sanitized = sanitized.replace(/(\d+\.\d{10,})/g, (match) => {
            return parseFloat(match).toFixed(2);
        });

        return JSON.parse(sanitized);
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
  return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
};

export const analyzeRecipeWithGemini = async (
    recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>
): Promise<Pick<Recipe, 'description' | 'macros' | 'healthScore' | 'scoreReasoning' | 'servings' | 'usageIntensity'>> => {
    const prompt = `
        Analyze the following recipe and return its nutritional information (macros), a health score (1-10), a brief reasoning for the score, and suggest a usageIntensity (light, normal, or heavy).
        IMPORTANT: Scale ingredients and macros so that they represent exactly ONE (1) individual serving for one person. Set servings to 1.
        Recipe Name: ${recipe.name}
        Ingredients: ${recipe.ingredients}
        Instructions: ${recipe.instructions}

        Provide JSON.
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    macros: {
                        type: Type.OBJECT,
                        properties: {
                            calories: { type: Type.NUMBER },
                            protein: { type: Type.NUMBER },
                            carbs: { type: Type.NUMBER },
                            fat: { type: Type.NUMBER }
                        },
                        required: ["calories", "protein", "carbs", "fat"]
                    },
                    healthScore: { type: Type.NUMBER },
                    scoreReasoning: { type: Type.STRING },
                    usageIntensity: { type: Type.STRING, enum: ["light", "normal", "heavy"] },
                    servings: { type: Type.NUMBER }
                },
                required: ["description", "macros", "healthScore", "scoreReasoning", "usageIntensity", "servings"]
            }
        }
    }));

    const result = parseJsonGracefully<any>(response.text);
    if (!result) throw new Error("AI response was not valid JSON.");
    return result;
};

export const generateShoppingListWithGemini = async (allIngredients: string): Promise<{ category: string; items: string[] }[]> => {
    const prompt = `
        Given the following list of ingredients from multiple recipes, create a categorized shopping list.
        Combine similar items and aggregate quantities.
        Group the items into supermarket categories (e.g., "Produce", "Dairy & Eggs").

        Ingredients List:
        ${allIngredients}

        Return JSON array of objects: { "category": string, "items": string[] }
    `;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { category: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
                    required: ["category", "items"],
                }
            }
        }
    }));
    const result = parseJsonGracefully<{ category: string; items: string[] }[]>(response.text);
    return result || [];
};

export const categorizeShoppingItemWithGemini = async (itemName: string): Promise<string> => {
    const prompt = `Categorize "${itemName}" into a supermarket category. Return JSON object with key "category".`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { category: { type: Type.STRING } },
                required: ["category"]
            }
        }
    }));
    const result = parseJsonGracefully<{ category: string }>(response.text);
    return result?.category || "Other";
};

export const parseRecipeFromTextWithGemini = async (text: string): Promise<GeneratedRecipeData> => {
    const prompt = `Extract recipe: name, brief description, ingredients, instructions, and category (Breakfast, Dinner, Snack, or Drink). 
    CRITICAL: Scale ingredients to exactly ONE (1) serving. Set servings to 1. Return JSON.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: text.substring(0, 15000),
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
                    servings: { type: Type.NUMBER },
                    usageIntensity: { type: Type.STRING, enum: ["light", "normal", "heavy"] },
                },
                required: ["name", "ingredients", "instructions", "category", "servings"],
            }
        }
    }));
    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("AI could not parse recipe.");
    return result;
};

export const suggestNutritionGoalsWithGemini = async (
    gender: 'male' | 'female', age: number, height: number, weight: number, activityLevel: string
): Promise<NutritionGoals> => {
    const prompt = `Calculate daily calorie and macro goals for: ${gender}, ${age}y, ${height}cm, ${weight}kg, Activity: ${activityLevel}. Return JSON { calories, protein, carbs, fat }.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
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
                    fat: { type: Type.NUMBER }
                },
                required: ["calories", "protein", "carbs", "fat"]
            }
        }
    }));
    const result = parseJsonGracefully<NutritionGoals>(response.text);
    if (!result) throw new Error("AI could not suggest goals.");
    return result;
};

export const generateRecipeFromIdeaWithGemini = async (
    idea: string, category: RecipeCategory, blacklistedIngredients: string[]
): Promise<GeneratedRecipeData> => {
    const blacklist = blacklistedIngredients.length > 0 ? `DO NOT USE: ${blacklistedIngredients.join(', ')}.` : '';
    const prompt = `Create a recipe for "${idea}" in "${category}". Provide name, one-sentence description, ingredients, instructions. 
    CRITICAL: Ingredients must be scaled for exactly ONE (1) serving. Set servings to 1. ${blacklist} Return JSON.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    ingredients: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
                    servings: { type: Type.NUMBER },
                    usageIntensity: { type: Type.STRING, enum: ["light", "normal", "heavy"] },
                },
                required: ["name", "ingredients", "instructions", "category", "servings"],
            }
        }
    }));
    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("AI could not generate recipe.");
    return result;
};

const bulkRecipeItemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        ingredients: { type: Type.STRING },
        instructions: { type: Type.STRING },
        category: { type: Type.STRING, enum: Object.values(RecipeCategory) },
        macros: { 
            type: Type.OBJECT, 
            properties: { 
                calories: { type: Type.NUMBER }, 
                protein: { type: Type.NUMBER }, 
                carbs: { type: Type.NUMBER }, 
                fat: { type: Type.NUMBER } 
            }, 
            required: ["calories", "protein", "carbs", "fat"] 
        },
        healthScore: { type: Type.NUMBER },
        scoreReasoning: { type: Type.STRING },
        usageIntensity: { type: Type.STRING, enum: ["light", "normal", "heavy"] },
        servings: { type: Type.NUMBER },
    },
    required: ["name", "ingredients", "instructions", "category", "macros", "healthScore", "scoreReasoning", "servings", "usageIntensity"],
};

const bulkRecipeSchema = {
    type: Type.ARRAY,
    items: bulkRecipeItemSchema
};

export const bulkParseRecipesFromFileWithGemini = async (
    file: File, 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const filePart = await fileToGenerativePart(file);
    const prompt = `Analyze file and extract recipes. SCALE each to exactly ONE (1) individual serving (Set servings: 1). Note user goals: ${JSON.stringify(nutritionGoals)}. ${blacklistedIngredients.length > 0 ? `Avoid: ${blacklistedIngredients.join(',')}` : ''} Return JSON array.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: { parts: [ { text: prompt }, filePart ] },
        config: { responseMimeType: "application/json", responseSchema: bulkRecipeSchema as any }
    }));
    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) throw new Error("AI could not parse file.");
    return result;
};

export const bulkGenerateAndAnalyzeRecipesWithGemini = async (
    ideas: string[], 
    category: RecipeCategory, 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const prompt = `Generate ${ideas.length} healthy recipes for: ${ideas.join(', ')}. Category: ${category}. Scale EACH to exactly ONE (1) serving (Set servings: 1). Health goals: ${JSON.stringify(nutritionGoals)}. Return JSON array.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: bulkRecipeSchema as any }
    }));
    const result = parseJsonGracefully<BulkParsedRecipe[]>(response.text);
    if (!result) throw new Error("AI could not generate recipes.");
    return result;
};

export const editRecipeWithGemini = async (
    originalRecipe: Recipe,
    editRequest: string,
    blacklistedIngredients: string[]
): Promise<BulkParsedRecipe> => {
    const prompt = `Edit recipe: ${JSON.stringify(originalRecipe)}. Request: "${editRequest}". Maintain portions for exactly ONE (1) serving. Re-analyze macros, health score, and usageIntensity. Return JSON object.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeItemSchema as any
        }
    }));
    const result = parseJsonGracefully<BulkParsedRecipe>(response.text);
    if (!result) throw new Error("AI could not edit.");
    return result;
};

export interface ReconciliationResult {
    originalId: string;
    changesSummary: string;
    updatedRecipe: BulkParsedRecipe;
}

export const reconcileRecipesWithBlacklist = async (
    recipes: Recipe[],
    blacklistedIngredient: string
): Promise<ReconciliationResult[]> => {
    const candidates = recipes.filter(r => 
        r.ingredients.toLowerCase().includes(blacklistedIngredient.toLowerCase()) ||
        r.name.toLowerCase().includes(blacklistedIngredient.toLowerCase())
    );

    if (candidates.length === 0) return [];

    const prompt = `
        The user has blacklisted the ingredient: "${blacklistedIngredient}". 
        Review the following recipes and for each one that contains this ingredient or is conceptually centered around it:
        1. Provide a suitable healthy substitute or remove it entirely.
        2. Recalculate all macros (calories, protein, carbs, fat) for ONE (1) serving.
        3. Update ingredients list and instructions accordingly.
        4. Re-evaluate the health score and usageIntensity.

        Recipes to check:
        ${JSON.stringify(candidates.map(r => ({ id: r.id, name: r.name, ingredients: r.ingredients, instructions: r.instructions })))}

        Return a JSON array of ReconciliationResult objects:
        { "originalId": string, "changesSummary": string, "updatedRecipe": BulkParsedRecipe }
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        originalId: { type: Type.STRING },
                        changesSummary: { type: Type.STRING },
                        updatedRecipe: bulkRecipeItemSchema as any
                    },
                    required: ["originalId", "changesSummary", "updatedRecipe"]
                }
            }
        }
    }));

    const result = parseJsonGracefully<ReconciliationResult[]>(response.text);
    return result || [];
};

export const checkForDuplicatesWithGemini = async (
    newRecipe: Partial<Recipe>,
    existingRecipes: Recipe[]
): Promise<{ isDuplicate: boolean; similarRecipeName: string | null; reasoning: string }> => {
    if (existingRecipes.length === 0) return { isDuplicate: false, similarRecipeName: null, reasoning: "" };
    const prompt = `Check if "${newRecipe.name}" is a duplicate of any of these: ${existingRecipes.map(r => r.name).join('; ')}. Return JSON.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN },
                    similarRecipeName: { type: Type.STRING, nullable: true },
                    reasoning: { type: Type.STRING }
                },
                required: ["isDuplicate", "reasoning"]
            }
        }
    }));
    const result = parseJsonGracefully<any>(response.text);
    return result || { isDuplicate: false, similarRecipeName: null, reasoning: "" };
};

export const findSimilarRecipesWithGemini = async (recipes: Recipe[]): Promise<SimilarityGroup[]> => {
    if (recipes.length < 2) return [];
    const prompt = `
        Examine this list of recipes and identify pairs or groups that are very similar in nature (e.g. "Cottage Cheese Cup" and "Cottage Cheese Power Bowl").
        Return a JSON array of SimilarityGroup objects.
        Each object: { "primaryRecipeId": "id of the main one", "similarRecipeIds": ["list of other ids"], "reasoning": "why they are similar" }
        Only include genuinely similar items, not just anything in the same category.
        Recipes: ${JSON.stringify(recipes.map(r => ({id: r.id, name: r.name, ingredients: r.ingredients.substring(0, 100)})))}
    `;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        primaryRecipeId: { type: Type.STRING },
                        similarRecipeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        reasoning: { type: Type.STRING }
                    },
                    required: ["primaryRecipeId", "similarRecipeIds", "reasoning"]
                }
            }
        }
    }));
    return parseJsonGracefully<SimilarityGroup[]>(response.text) || [];
};

export const generateMealPlanWithGemini = async (settings: Settings, recipes: Recipe[], startDate: string, drinkRecipe?: Recipe, drinkQtyPerPerson: number = 2): Promise<MealPlan> => {
    const startObj = new Date(startDate + 'T00:00:00');
    const prepObj = new Date(startObj);
    prepObj.setDate(startObj.getDate() - 1);
    const prepDateStr = prepObj.toISOString().split('T')[0];

    const drinkKcal = drinkRecipe ? drinkRecipe.macros.calories * drinkQtyPerPerson : 0;
    
    const peopleGoals = settings.people.map(p => ({
        name: p.name,
        dailyTarget: p.goals.calories - (settings.fudgeRoom || 0) - drinkKcal,
        macros: p.goals
    }));

    const totalSlots = { breakfast: 0, snack: 0, dinner: 0, lunch: 0 };
    Object.values(settings.dailyMeals).forEach(day => {
        if (day.breakfast) totalSlots.breakfast++;
        if (day.snack) totalSlots.snack++;
        if (day.dinner) totalSlots.dinner++;
        if (day.lunch) totalSlots.lunch++;
    });

    const categorized = {
        dinners: recipes.filter(r => r.category === RecipeCategory.Dinner),
        breakfasts: recipes.filter(r => r.category === RecipeCategory.Breakfast || r.isAlsoBreakfast),
        snacks: recipes.filter(r => r.category === RecipeCategory.Snack || r.isAlsoSnack),
    };

    const prompt = `
        Generate a strictly balanced meal plan for ${settings.planDurationWeeks} week(s) starting from ${startDate}.
        
        PREP DAY RESTRICTION: 
        - ${prepDateStr} is marked as isMealPrepDay: true. 
        - CRITICAL: NO EATING occurs on a Prep Day. breakfastId, lunchId, snackId, and dinnerId MUST be null or omitted. NO morning drink.
        
        PLANNING REQUIREMENTS (STRICT):
        - You must fill exactly ${totalSlots.breakfast} breakfast slots, ${totalSlots.snack} snack slots, and ${totalSlots.dinner} dinner slots per week.
        - UNIQUE RECIPE TARGETS: Exactly ${settings.dinnersPerWeek} unique Dinners, ${settings.breakfastsPerWeek} unique Breakfasts, and ${settings.snacksPerWeek} unique Snacks.
        
        CATEGORY EXCLUSIVITY RULES:
        1. NO CROSSOVER: A recipe ID chosen for a Breakfast slot MUST NOT be used for a Snack slot in this plan, even if it is tagged as both. 
        2. SLOT OWNERSHIP: If you put a meal in 'breakfastId', it is a Breakfast. If in 'snackId', it is a Snack. Do not mix them.
        
        VARIETY & SIMILARITY RULES:
        1. FOOD FAMILIES: Recipes with similar names or ingredients belong to the same "Family".
        2. VARIETY LIMIT: Across ALL Breakfast and Snack slots COMBINED, do not use more than 2 distinct recipes from the same Food Family in a 7-day period.
        3. MAX TOTAL REPETITION: No single ID can appear more than ${settings.maxUsesPerRecipePerPlan} times total per person per 7 days (including lunch leftovers).

        DINNER/LUNCH LEFTOVER LOGIC:
        - IF useLeftoverForLunch is true: Use lunch slots to consume leftovers of previously cooked dinners.
        - STAGGERING: Aim to avoid eating the same recipe on consecutive days. For example, if Monday dinner is Pasta, try to make Wednesday lunch Pasta instead of Tuesday.
        - SEQUENCE PREFERENCE: If you must serve a recipe on consecutive days, prefer serving it as Lunch on Day 1 and then Dinner on Day 2 (implying it was prepped in advance).

        NUTRITION:
        Adjust portions (arrays for ${settings.people.map(p => p.name).join(', ')}) to hit targets: ${JSON.stringify(peopleGoals)}.

        DAILY PATTERN:
        ${JSON.stringify(settings.dailyMeals)}

        AVAILABLE DATA:
        - DINNERS: ${JSON.stringify(categorized.dinners.map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}
        - BREAKFASTS: ${JSON.stringify(categorized.breakfasts.map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}
        - SNACKS: ${JSON.stringify(categorized.snacks.map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}

        Return a JSON array of objects.
        Format: { "date": "YYYY-MM-DD", "breakfastId", "breakfastPortions": [], "lunchId", "lunchPortions": [], "snackId", "snackPortions": [], "dinnerId", "dinnerPortions": [], "isMealPrepDay": bool }
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    }));

    const parsedPlan = parseJsonGracefully<any[]>(response.text);
    const plan: MealPlan = new Map();
    if (parsedPlan) {
        parsedPlan.forEach(day => {
            const isPrepDay = day.isMealPrepDay || false;
            plan.set(day.date, {
                breakfast: isPrepDay ? undefined : recipes.find(r => r.id === day.breakfastId),
                breakfastPortions: isPrepDay ? undefined : (day.breakfastPortions || settings.people.map(() => 1)),
                lunch: isPrepDay ? undefined : recipes.find(r => r.id === day.lunchId),
                lunchPortions: isPrepDay ? undefined : (day.lunchPortions || settings.people.map(() => 1)),
                dinner: isPrepDay ? undefined : recipes.find(r => r.id === day.dinnerId),
                dinnerPortions: isPrepDay ? undefined : (day.dinnerPortions || settings.people.map(() => 1)),
                snack: isPrepDay ? undefined : recipes.find(r => r.id === day.snackId),
                snackPortions: isPrepDay ? undefined : (day.snackPortions || settings.people.map(() => 1)),
                drink: isPrepDay ? undefined : drinkRecipe,
                drinkQuantity: isPrepDay ? undefined : drinkQtyPerPerson,
                isMealPrepDay: isPrepDay
            });
        });
    }
    return plan;
};

export const generatePrepWorkflowWithGemini = async (selectedItems: { recipe: Recipe; totalServings: number }[]): Promise<PrepWorkflow> => {
    const recipesData = selectedItems.map(item => ({
        name: item.recipe.name,
        totalServings: item.totalServings,
        ingredients: item.recipe.ingredients,
        instructions: item.recipe.instructions
    }));

    const prompt = `
        You are a Batch Cooking Expert. Generate a systematic, highly efficient "Prep Mode" workflow for the following list of recipes and their total serving requirements.
        
        GOAL: Optimize prep time by grouping similar tasks (e.g., chop all onions at once, cook all ground beef together if applicable).
        
        RECIPES TO BATCH:
        ${JSON.stringify(recipesData)}

        OUTPUT FORMAT (JSON ONLY):
        {
            "requiredIngredients": ["Consolidated and scaled list of all ingredients to pull out of the pantry/fridge"],
            "steps": [
                {
                    "title": "Short title",
                    "description": "Detailed batch instruction. E.g., 'Chop all 3 onions and 4 bell peppers. Keep them in separate bowls for now.'",
                    "estimatedMinutes": number,
                    "type": "setup" | "prep" | "cooking" | "storage"
                }
            ]
        }

        INSTRUCTIONS:
        1. Phase 1 (Setup): Pull out ingredients and tools.
        2. Phase 2 (Prep): All chopping, washing, and measuring. Group items by overlap.
        3. Phase 3 (Cooking): Simultaneous or batch cooking steps. If two recipes use ground beef, cook the total required amount at once and divide later.
        4. Phase 4 (Storage): How to divide and store the prepped components for the week.
        
        Keep it concise but clear. Ensure quantities are scaled to the "totalServings" provided for each recipe.
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    requiredIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                estimatedMinutes: { type: Type.NUMBER },
                                type: { type: Type.STRING, enum: ['setup', 'prep', 'cooking', 'storage'] }
                            },
                            required: ["title", "description", "estimatedMinutes", "type"]
                        }
                    }
                },
                required: ["requiredIngredients", "steps"]
            }
        }
    }));

    const result = parseJsonGracefully<PrepWorkflow>(response.text);
    if (!result) throw new Error("Failed to generate prep workflow.");
    return result;
};

export const generateShoppingAgentInstructions = async (
    store: string,
    service: string,
    dateTime: string,
    items: string[],
    userGoals: string,
    hasAccount: boolean,
    useThirdParty: boolean
): Promise<string> => {
    const prompt = `
        Generate concise, step-by-step instructions for an autonomous browser agent to perform a grocery shopping task for ${items.length} items at ${store} for ${service} on ${dateTime}.
        Return ONLY the instruction text, optimized for an LLM-based browser agent.
    `;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
    }));
    return response.text || "Failed to generate instructions.";
};