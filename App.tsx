
import React, { useState, useEffect, useCallback } from 'react';
import { Tab, MealPlan, EatenLog, Settings, Recipe, RecipeCategory, RecipeTag, PlannedMeal, GeneratedRecipeData, MealType } from './types';
import { TABS, DEFAULT_SETTINGS, DEFAULT_ALL_TAGS } from './constants';
import { analyzeRecipeWithGemini, generateMealPlanWithGemini, generateRecipeFromIdeaWithGemini, parseRecipeFromTextWithGemini } from './services/geminiService';
import Header from './components/Header';
import PlannerView from './components/PlannerView';
import ShoppingListView from './components/ShoppingListView';
import MealsView from './components/MealsView';
import LogView from './components/LogView';
import SettingsView from './components/SettingsView';
import KitchenModeView from './components/KitchenModeView';
import EditMealModal from './components/EditMealModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [mealPlan, setMealPlan] = useState<MealPlan>(new Map());
  const [eatenLog, setEatenLog] = useState<EatenLog>(new Map());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allTags, setAllTags] = useState<Record<RecipeCategory, RecipeTag[]>>(DEFAULT_ALL_TAGS);
  const [isLoading, setIsLoading] = useState(false);
  const [kitchenModeRecipe, setKitchenModeRecipe] = useState<Recipe | null>(null);
  const [editMealDetails, setEditMealDetails] = useState<{ date: string, plan: PlannedMeal } | null>(null);

  // Load data from localStorage on initial render
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('mealPlannerSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      const savedTags = localStorage.getItem('mealPlannerTags');
      if (savedTags) setAllTags(JSON.parse(savedTags));

      const savedRecipes = localStorage.getItem('mealPlannerRecipes');
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));

      const savedMealPlan = localStorage.getItem('mealPlannerPlan');
      if (savedMealPlan) setMealPlan(new Map(JSON.parse(savedMealPlan)));
      
      const savedEatenLog = localStorage.getItem('mealPlannerEatenLog');
      if (savedEatenLog) setEatenLog(new Map(JSON.parse(savedEatenLog)));
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
        // Reset to defaults if parsing fails
        setSettings(DEFAULT_SETTINGS);
        setAllTags(DEFAULT_ALL_TAGS);
        setRecipes([]);
        setMealPlan(new Map());
        setEatenLog(new Map());
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mealPlannerSettings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem('mealPlannerTags', JSON.stringify(allTags));
  }, [allTags]);
  useEffect(() => {
    localStorage.setItem('mealPlannerRecipes', JSON.stringify(recipes));
  }, [recipes]);
  useEffect(() => {
    localStorage.setItem('mealPlannerPlan', JSON.stringify(Array.from(mealPlan.entries())));
  }, [mealPlan]);
  useEffect(() => {
    localStorage.setItem('mealPlannerEatenLog', JSON.stringify(Array.from(eatenLog.entries())));
  }, [eatenLog]);

  const handleDayClick = (date: string, plan: PlannedMeal) => {
    setEditMealDetails({ date, plan });
  };

  const handleMarkAsEaten = (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', eaten: boolean) => {
    setEatenLog(prev => {
        const newLog = new Map(prev);
        const dayLog = newLog.get(date) || {};
        dayLog[mealType] = eaten;
        if (Object.values(dayLog).every(v => !v)) {
            newLog.delete(date);
        } else {
            newLog.set(date, dayLog);
        }
        return newLog;
    });
  };
  
  const generatePlan = async () => {
    if (recipes.length < 5) {
      alert("You need at least 5 recipes to generate a meal plan.");
      return;
    }
    setIsLoading(true);
    try {
      const newPlan = await generateMealPlanWithGemini(settings, recipes);
      setMealPlan(newPlan);
      alert("Meal plan generated successfully!");
    } catch (error) {
      console.error("Failed to generate meal plan:", error);
      alert("An error occurred while generating the meal plan. Please check the console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const addRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
    setIsLoading(true);
    try {
        const analysis = await analyzeRecipeWithGemini(recipeData);
        const newRecipe: Recipe = {
            id: `recipe_${Date.now()}_${Math.random()}`,
            ...recipeData,
            ...analysis,
        };
        setRecipes(prev => [...prev, newRecipe]);
    } catch (error) {
        console.error("Failed to add recipe:", error);
        alert("Could not analyze and add the new recipe. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    setIsLoading(true);
    try {
        const analysis = await analyzeRecipeWithGemini(updatedRecipe);
        const finalRecipe: Recipe = { ...updatedRecipe, ...analysis };

        setRecipes(prev => prev.map(r => r.id === finalRecipe.id ? finalRecipe : r));
        
        // Also update the recipe in the meal plan if it exists
        setMealPlan(prev => {
            const newPlan = new Map(prev);
            for (const [date, dayPlan] of newPlan.entries()) {
                let updated = false;
                const newDayPlan = { ...dayPlan };
                for (const mealType in newDayPlan) {
                    if (newDayPlan[mealType as keyof PlannedMeal]?.id === finalRecipe.id) {
                       newDayPlan[mealType as keyof PlannedMeal] = finalRecipe;
                       updated = true;
                    }
                }
                if (updated) {
                    newPlan.set(date, newDayPlan);
                }
            }
            return newPlan;
        });

    } catch (error) {
        console.error("Failed to update recipe:", error);
        alert("Could not analyze and update the recipe. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  const deleteRecipe = (recipeId: string) => {
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
    // Optional: remove from meal plan or warn user
  };
  
  const bulkImportRecipes = async (
    documentText: string, 
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string) => void,
    onComplete: (count: number) => void
  ) => {
      // A crude way to split recipes from a text blob
      const recipeChunks = documentText.split(/[\r\n]{2,}(?=[A-Z\s]{3,}[\r\n])/).filter(s => s.trim().length > 10);
      let importedCount = 0;
      
      for (let i = 0; i < recipeChunks.length; i++) {
        const chunk = recipeChunks[i];
        try {
            onProgress(`Processing recipe ${i + 1} of ${recipeChunks.length}...`);
            let recipeData: GeneratedRecipeData;
            let category = RecipeCategory.Dinner; // Default category

            if (importMode === 'meal_ideas') {
                recipeData = await generateRecipeFromIdeaWithGemini(chunk, category, allTags.Dinner);
            } else {
                const parsed = await parseRecipeFromTextWithGemini(chunk, allTags.Dinner);
                recipeData = { ...parsed, category };
            }

            const analysis = await analyzeRecipeWithGemini(recipeData);
            const newRecipe: Recipe = {
                id: `recipe_${Date.now()}_${i}`,
                ...recipeData,
                ...analysis,
                rating: 5,
            };
            setRecipes(prev => [...prev, newRecipe]);
            importedCount++;

        } catch (error) {
            console.warn(`Skipping a chunk during bulk import due to error:`, error);
        }
    }
    onComplete(importedCount);
  };

  const renderContent = () => {
    switch (activeTab.id) {
      case 'planner':
        return <PlannerView 
                  mealPlan={mealPlan} 
                  eatenLog={eatenLog} 
                  generatePlan={generatePlan} 
                  isLoading={isLoading} 
                  onDayClick={handleDayClick}
                  onMarkAsEaten={handleMarkAsEaten}
                  setActiveTab={setActiveTab}
                />;
      case 'shopping':
        return <ShoppingListView mealPlan={mealPlan} />;
      case 'meals':
        return <MealsView 
                  recipes={recipes} 
                  addRecipe={addRecipe}
                  updateRecipe={updateRecipe}
                  deleteRecipe={deleteRecipe}
                  isLoading={isLoading}
                  allTags={allTags}
                  bulkImportRecipes={bulkImportRecipes}
               />;
      case 'log':
        return <LogView eatenLog={eatenLog} mealPlan={mealPlan} />;
      case 'settings':
        return <SettingsView settings={settings} onSettingsChange={setSettings} allTags={allTags} onAllTagsChange={setAllTags} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
        <div className="container mx-auto p-4 md:p-6">
            <Header activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="mt-6 bg-white p-6 rounded-lg shadow-sm">
                {renderContent()}
            </main>
        </div>
        {kitchenModeRecipe && <KitchenModeView recipe={kitchenModeRecipe} onClose={() => setKitchenModeRecipe(null)} />}
        {editMealDetails && (
            <EditMealModal
                onClose={() => setEditMealDetails(null)}
                onSave={(mealType, newRecipe) => {
                    setMealPlan(prev => {
                        const newPlan = new Map(prev);
                        const dayPlan = newPlan.get(editMealDetails.date);
                        if (dayPlan) {
                            newPlan.set(editMealDetails.date, { ...dayPlan, [mealType]: newRecipe });
                        }
                        return newPlan;
                    });
                    setEditMealDetails(null);
                }}
                recipes={recipes}
                dayPlan={editMealDetails.plan}
                date={editMealDetails.date}
            />
        )}
    </div>
  );
};

export default App;
