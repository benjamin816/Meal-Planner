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
            const errorText = error.message || "";
            const isRateLimit = errorText.includes("429") || errorText.includes("RESOURCE_EXHAUSTED");
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

/**
 * Robustly parses JSON from LLM output, handling markdown blocks or raw strings.
 */
const parseJsonGracefully = <T>(jsonString: string | undefined): T | null => {
    if (!jsonString) return null;
    try {
        let sanitized = jsonString.trim();
        const match = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(sanitized);
        if (match) {
            sanitized = match[1].trim();
        }
        
        sanitized = sanitized.replace(/(\d+\.\d{8,})/g, (m) => {
            return parseFloat(m).toFixed(4);
        });

        return JSON.parse(sanitized);
    } catch (error) {
        console.error("Failed to parse AI JSON response:", jsonString);
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

// Fix: Added ReconciliationResult interface for ingredient blacklist reconciliation
export interface ReconciliationResult {
    originalId: string;
    updatedRecipe: Partial<Recipe>;
    changesSummary: string;
}

export const analyzeRecipeWithGemini = async (
    recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>
): Promise<Pick<Recipe, 'description' | 'macros' | 'healthScore' | 'scoreReasoning' | 'servings' | 'usageIntensity'>> => {
    const prompt = `
        Analyze this recipe. Return nutritional info, health score (1-10), reasoning, and usageIntensity (light, normal, heavy).
        CRITICAL: All quantities must represent exactly ONE (1) serving.
        If specific brands like 'Quest' are mentioned, provide estimated generic nutritional data for those items.
        
        Recipe: ${recipe.name}
        Ingredients: ${recipe.ingredients}
        Instructions: ${recipe.instructions}
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
                    usageIntensity: { type: Type.STRING },
                    servings: { type: Type.NUMBER }
                },
                required: ["description", "macros", "healthScore", "scoreReasoning", "usageIntensity", "servings"]
            }
        }
    }));

    const result = parseJsonGracefully<any>(response.text);
    if (!result) throw new Error("AI analysis failed or returned invalid data.");
    
    if (!['light', 'normal', 'heavy'].includes(result.usageIntensity)) {
        result.usageIntensity = 'normal';
    }
    
    return result;
};

export const generateShoppingListWithGemini = async (allIngredients: string): Promise<{ category: string; items: string[] }[]> => {
    const prompt = `
        Create a categorized supermarket shopping list from these ingredients.
        Combine duplicates and group by category (e.g., Produce, Meat).
        
        Ingredients:
        ${allIngredients}
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
                        category: { type: Type.STRING }, 
                        items: { type: Type.ARRAY, items: { type: Type.STRING } } 
                    },
                    required: ["category", "items"],
                }
            }
        }
    }));
    return parseJsonGracefully<{ category: string; items: string[] }[]>(response.text) || [];
};

export const categorizeShoppingItemWithGemini = async (itemName: string): Promise<string> => {
    const prompt = `Return a supermarket category for: "${itemName}".`;
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
    const prompt = `Extract recipe details. CRITICAL: Scale ingredients to ONE (1) serving.
    ${text.substring(0, 10000)}`;
    
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
                    category: { type: Type.STRING },
                    servings: { type: Type.NUMBER },
                    usageIntensity: { type: Type.STRING },
                },
                required: ["name", "ingredients", "instructions", "category", "servings"],
            }
        }
    }));
    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("Could not parse recipe from text.");
    return result;
};

export const suggestNutritionGoalsWithGemini = async (
    gender: 'male' | 'female', age: number, height: number, weight: number, activityLevel: string
): Promise<NutritionGoals> => {
    const prompt = `Suggest daily calories and macro percentages for: ${gender}, ${age}y, ${height}cm, ${weight}kg, Activity: ${activityLevel}.`;
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
    if (!result) throw new Error("Could not calculate goals.");
    return result;
};

export const generateRecipeFromIdeaWithGemini = async (
    idea: string, category: RecipeCategory, blacklistedIngredients: string[]
): Promise<GeneratedRecipeData> => {
    const blacklist = blacklistedIngredients.length > 0 ? `Avoid: ${blacklistedIngredients.join(', ')}.` : '';
    const prompt = `Create a healthy recipe for "${idea}" in "${category}". Scale for ONE (1) serving. ${blacklist}`;
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
                    category: { type: Type.STRING },
                    servings: { type: Type.NUMBER },
                    usageIntensity: { type: Type.STRING },
                },
                required: ["name", "ingredients", "instructions", "category", "servings"],
            }
        }
    }));
    const result = parseJsonGracefully<GeneratedRecipeData>(response.text);
    if (!result) throw new Error("Could not generate recipe.");
    return result;
};

const bulkRecipeItemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        ingredients: { type: Type.STRING },
        instructions: { type: Type.STRING },
        category: { type: Type.STRING },
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
        usageIntensity: { type: Type.STRING },
        servings: { type: Type.NUMBER },
    },
    required: ["name", "ingredients", "instructions", "category", "macros", "healthScore", "scoreReasoning", "servings", "usageIntensity"],
};

export const bulkParseRecipesFromFileWithGemini = async (
    file: File, 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const filePart = await fileToGenerativePart(file);
    const prompt = `Extract all recipes from file. Scale to ONE (1) serving. Goals: ${JSON.stringify(nutritionGoals)}.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: { parts: [ { text: prompt }, filePart ] },
        config: { 
            responseMimeType: "application/json", 
            responseSchema: { type: Type.ARRAY, items: bulkRecipeItemSchema as any } 
        }
    }));
    return parseJsonGracefully<BulkParsedRecipe[]>(response.text) || [];
};

export const bulkGenerateAndAnalyzeRecipesWithGemini = async (
    ideas: string[], 
    category: RecipeCategory, 
    blacklistedIngredients: string[],
    targetServings: number,
    nutritionGoals: NutritionGoals
): Promise<BulkParsedRecipe[]> => {
    const prompt = `Generate healthy recipes for: ${ideas.join(', ')}. Scale to ONE (1) serving.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: { type: Type.ARRAY, items: bulkRecipeItemSchema as any } 
        }
    }));
    return parseJsonGracefully<BulkParsedRecipe[]>(response.text) || [];
};

export const editRecipeWithGemini = async (
    originalRecipe: Recipe,
    editRequest: string,
    blacklistedIngredients: string[]
): Promise<BulkParsedRecipe> => {
    const prompt = `Edit recipe: ${originalRecipe.name}. Request: "${editRequest}". Maintain ONE (1) serving portions.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: bulkRecipeItemSchema as any
        }
    }));
    const result = parseJsonGracefully<BulkParsedRecipe>(response.text);
    if (!result) throw new Error("Edit failed.");
    return result;
};

// Fix: Implemented reconcileRecipesWithBlacklist function to handle automatic ingredient substitution
/**
 * Scans a list of recipes for a blacklisted ingredient and uses Gemini to remove/substitute it.
 */
export const reconcileRecipesWithBlacklist = async (
    recipes: Recipe[],
    blacklistIngredient: string
): Promise<ReconciliationResult[]> => {
    const relevantRecipes = recipes.filter(r => 
        r.ingredients.toLowerCase().includes(blacklistIngredient.toLowerCase()) ||
        r.name.toLowerCase().includes(blacklistIngredient.toLowerCase())
    );

    if (relevantRecipes.length === 0) return [];

    const prompt = `
        The ingredient "${blacklistIngredient}" is now blacklisted. 
        For each of the following recipes, remove or substitute this ingredient.
        Update the ingredients list and instructions. Recalculate macros and health score.
        All portions must remain scaled for exactly ONE (1) serving.
        
        Recipes to reconcile:
        ${JSON.stringify(relevantRecipes.map(r => ({ id: r.id, name: r.name, ingredients: r.ingredients, instructions: r.instructions, macros: r.macros })))}
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
                        updatedRecipe: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                ingredients: { type: Type.STRING },
                                instructions: { type: Type.STRING },
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
                                healthScore: { type: Type.NUMBER }
                            },
                            required: ["ingredients", "instructions", "macros", "healthScore"]
                        },
                        changesSummary: { type: Type.STRING }
                    },
                    required: ["originalId", "updatedRecipe", "changesSummary"]
                }
            }
        }
    }));

    return parseJsonGracefully<ReconciliationResult[]>(response.text) || [];
};

export const findSimilarRecipesWithGemini = async (recipes: Recipe[]): Promise<SimilarityGroup[]> => {
    if (recipes.length < 2) return [];
    const prompt = `Identify duplicate or very similar recipes in this list.`;
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
    const drinkKcal = drinkRecipe ? drinkRecipe.macros.calories * drinkQtyPerPerson : 0;
    
    const peopleGoals = settings.people.map(p => ({
        name: p.name,
        dailyTarget: p.goals.calories - (settings.fudgeRoom || 0) - drinkKcal,
        macros: p.goals
    }));

    const prompt = `
        Generate a balanced meal plan starting ${startDate} for ${settings.planDurationWeeks} weeks.
        
        Targets (Daily): ${JSON.stringify(peopleGoals)}
        
        DINNERS: ${JSON.stringify(recipes.filter(r => r.category === RecipeCategory.Dinner).map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}
        BREAKFASTS: ${JSON.stringify(recipes.filter(r => r.category === RecipeCategory.Breakfast || r.isAlsoBreakfast).map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}
        SNACKS: ${JSON.stringify(recipes.filter(r => r.category === RecipeCategory.Snack || r.isAlsoSnack).map(r => ({id: r.id, name: r.name, kcal: r.macros.calories})))}

        Daily Meals to fill: ${JSON.stringify(settings.dailyMeals)}
        
        Return JSON array: { "date": "YYYY-MM-DD", "breakfastId", "breakfastPortions": [], "lunchId", "lunchPortions": [], "snackId", "snackPortions": [], "dinnerId", "dinnerPortions": [] }
    `;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));

    const parsedPlan = parseJsonGracefully<any[]>(response.text);
    const plan: MealPlan = new Map();
    if (parsedPlan) {
        parsedPlan.forEach(day => {
            plan.set(day.date, {
                breakfast: recipes.find(r => r.id === day.breakfastId),
                breakfastPortions: day.breakfastPortions || settings.people.map(() => 1),
                lunch: recipes.find(r => r.id === day.lunchId),
                lunchPortions: day.lunchPortions || settings.people.map(() => 1),
                dinner: recipes.find(r => r.id === day.dinnerId),
                dinnerPortions: day.dinnerPortions || settings.people.map(() => 1),
                snack: recipes.find(r => r.id === day.snackId),
                snackPortions: day.snackPortions || settings.people.map(() => 1),
                drink: drinkRecipe,
                drinkQuantity: drinkQtyPerPerson,
                isMealPrepDay: false
            });
        });
    }
    return plan;
};

export const generatePrepWorkflowWithGemini = async (selectedItems: { recipe: Recipe; totalServings: number }[]): Promise<PrepWorkflow> => {
    const prompt = `Create an efficient batch cooking workflow for these items: ${JSON.stringify(selectedItems.map(s => ({n: s.recipe.name, qty: s.totalServings})))}.`;
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
                                type: { type: Type.STRING }
                            },
                            required: ["title", "description", "estimatedMinutes", "type"]
                        }
                    }
                },
                required: ["requiredIngredients", "steps"]
            }
        }
    }));
    return parseJsonGracefully<PrepWorkflow>(response.text) || { requiredIngredients: [], steps: [] };
};

export const generateShoppingAgentInstructions = async (
    store: string, service: string, dateTime: string, items: string[], userGoals: string, hasAccount: boolean, useThirdParty: boolean
): Promise<string> => {
    const prompt = `Instructions for autonomous agent to buy ${items.length} items at ${store} via ${service} on ${dateTime}.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
    }));
    return response.text || "Failed to generate instructions.";
};