
import React, { useState, useEffect, useCallback } from 'react';
import { Tab, MealPlan, EatenLog, Settings, Recipe, RecipeCategory, RecipeTag, PlannedMeal, GeneratedRecipeData, MealType, BulkParsedRecipe, NutritionGoals, ShoppingListCategory, ShoppingListItem } from './types';
import { TABS, DEFAULT_SETTINGS, DEFAULT_ALL_TAGS } from './constants';
import { analyzeRecipeWithGemini, generateMealPlanWithGemini, bulkParseRecipesFromFileWithGemini, bulkGenerateAndAnalyzeRecipesWithGemini, editRecipeWithGemini, checkForDuplicatesWithGemini, generateShoppingListWithGemini } from './services/geminiService';
import Header from './components/Header';
import PlannerView from './components/PlannerView';
import ShoppingListView from './components/ShoppingListView';
import MealsView from './components/MealsView';
import LogView from './components/LogView';
import SettingsView from './components/SettingsView';
import KitchenModeView from './components/KitchenModeView';
import EditMealModal from './components/EditMealModal';
import AddRecipeModal from './components/AddRecipeModal';


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [mealPlan, setMealPlan] = useState<MealPlan>(new Map());
  const [eatenLog, setEatenLog] = useState<EatenLog>(new Map());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allTags, setAllTags] = useState<Record<RecipeCategory, RecipeTag[]>>(DEFAULT_ALL_TAGS);
  const [shoppingList, setShoppingList] = useState<ShoppingListCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [kitchenModeRecipe, setKitchenModeRecipe] = useState<Recipe | null>(null);
  const [editMealDetails, setEditMealDetails] = useState<{ date: string, plan: PlannedMeal } | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | undefined>(undefined);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);


  // Load data from localStorage on initial render
  useEffect(() => {
    // Load Settings
    try {
      const savedSettings = localStorage.getItem('mealPlannerSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings) as Settings);
    } catch (error) {
      console.error("Failed to parse settings from localStorage.", error);
      setSettings(DEFAULT_SETTINGS);
    }
    
    // Load Tags
    try {
      const savedTags = localStorage.getItem('mealPlannerTags');
      if (savedTags) setAllTags(JSON.parse(savedTags) as Record<RecipeCategory, RecipeTag[]>);
    } catch (error) {
      console.error("Failed to parse tags from localStorage.", error);
      setAllTags(DEFAULT_ALL_TAGS);
    }

    // Load Recipes
    try {
      const savedRecipes = localStorage.getItem('mealPlannerRecipes');
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes) as Recipe[]);
    } catch (error) {
      console.error("Failed to parse recipes from localStorage.", error);
      setRecipes([]);
    }

    // Load Meal Plan
    try {
      const savedMealPlan = localStorage.getItem('mealPlannerPlan');
      if (savedMealPlan) setMealPlan(new Map(JSON.parse(savedMealPlan) as [string, PlannedMeal][]));
    } catch (error) {
      console.error("Failed to parse meal plan from localStorage.", error);
      setMealPlan(new Map());
    }

    // Load Eaten Log
    try {
      const savedEatenLog = localStorage.getItem('mealPlannerEatenLog');
      if (savedEatenLog) setEatenLog(new Map(JSON.parse(savedEatenLog) as [string, Partial<Record<MealType, boolean>>][]));
    } catch (error) {
      console.error("Failed to parse eaten log from localStorage.", error);
      setEatenLog(new Map());
    }

    // Load Shopping List
    try {
        const savedShoppingList = localStorage.getItem('mealPlannerShoppingList');
        if (savedShoppingList) setShoppingList(JSON.parse(savedShoppingList) as ShoppingListCategory[]);
    } catch (error) {
        console.error("Failed to parse shopping list from localStorage.", error);
        setShoppingList([]);
    }
    
    // Signal that initial data load is complete.
    setIsDataLoaded(true);
  }, []);

  // Save data to localStorage whenever it changes, ONLY after initial load is complete.
  useEffect(() => {
    if (isDataLoaded) localStorage.setItem('mealPlannerSettings', JSON.stringify(settings));
  }, [settings, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) localStorage.setItem('mealPlannerTags', JSON.stringify(allTags));
  }, [allTags, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) localStorage.setItem('mealPlannerRecipes', JSON.stringify(recipes));
  }, [recipes, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) localStorage.setItem('mealPlannerPlan', JSON.stringify(Array.from(mealPlan.entries())));
  }, [mealPlan, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) localStorage.setItem('mealPlannerEatenLog', JSON.stringify(Array.from(eatenLog.entries())));
  }, [eatenLog, isDataLoaded]);
  useEffect(() => {
      if (isDataLoaded) localStorage.setItem('mealPlannerShoppingList', JSON.stringify(shoppingList));
  }, [shoppingList, isDataLoaded]);

  const handleDayClick = (date: string, plan: PlannedMeal) => {
    setEditMealDetails({ date, plan });
  };
  
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setAnimationKey(prev => prev + 1); // Trigger animation on tab change
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

      // Auto-generate shopping list based on the new plan
      const allIngredients = Array.from(newPlan.values())
          .flatMap(dayPlan => [dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner, dayPlan.snack])
          .filter((r): r is Recipe => !!r)
          .map(r => r.ingredients)
          .join('\n');

      if (allIngredients.trim()) {
          const categorizedList = await generateShoppingListWithGemini(allIngredients);
          const newShoppingList: ShoppingListCategory[] = categorizedList.map((cat, idx) => ({
              id: `cat_${Date.now()}_${idx}`,
              name: cat.category,
              items: cat.items.map((item, itemIdx) => ({
                  id: `item_${Date.now()}_${idx}_${itemIdx}`,
                  name: item,
                  checked: false
              }))
          }));
          setShoppingList(newShoppingList);
      }

      alert("Meal plan and shopping list generated successfully!");
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
        const { isDuplicate, similarRecipeName, reasoning } = await checkForDuplicatesWithGemini(recipeData, recipes);
        if (isDuplicate) {
            alert(`This recipe seems to be a duplicate of "${similarRecipeName}".\n\nReasoning: ${reasoning}\n\nRecipe not added.`);
            return;
        }

        const analysis = await analyzeRecipeWithGemini(recipeData);
        
        let finalRecipeData: BulkParsedRecipe = {
            ...recipeData,
            ...analysis,
        };

        const targetServings = settings.numberOfPeople * settings.servingsPerPerson;
        if (finalRecipeData.servings !== targetServings && targetServings > 0) {
            console.log(`Auto-adjusting servings for "${finalRecipeData.name}" from ${finalRecipeData.servings} to ${targetServings}.`);
            const prompt = `Adjust this recipe from ${finalRecipeData.servings} servings to ${targetServings} servings. Update ingredient quantities and instructions accordingly.`;
            try {
                 finalRecipeData = await editRecipeWithGemini(finalRecipeData as any as Recipe, prompt, settings.blacklistedIngredients);
            } catch (error) {
                console.error(`Failed to auto-adjust servings for ${recipeData.name}. Adding with original servings.`, error);
                alert(`We couldn't automatically adjust the servings for "${recipeData.name}". It has been added with its original serving size.`);
            }
        }
        
        const newRecipe: Recipe = {
            id: `recipe_${Date.now()}_${Math.random()}`,
            ...finalRecipeData,
            rating: recipeData.rating,
            isAlsoBreakfast: recipeData.isAlsoBreakfast,
        };
        
        setRecipes(prev => [...prev, newRecipe]);
        setIsAddRecipeModalOpen(false); // Close modal on success

    } catch (error) {
        console.error("Failed to add recipe:", error);
        alert("Could not analyze and add the new recipe. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, [recipes, settings.numberOfPeople, settings.servingsPerPerson, settings.blacklistedIngredients]);

  const updateRecipeAndPlan = useCallback((updatedRecipe: Recipe) => {
    // Update the main recipe list
    setRecipes(prevRecipes => prevRecipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));

    // Update any instance of the recipe in the meal plan
    setMealPlan(prevPlan => {
        const newPlan = new Map(prevPlan);
        let planWasUpdated = false;

        for (const [date, dayPlan] of newPlan.entries()) {
            if (dayPlan && typeof dayPlan === 'object') {
                const newDayPlan: PlannedMeal = { ...dayPlan };
                let dayWasUpdated = false;
    
                const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
                for (const mealType of mealTypes) {
                    if (newDayPlan[mealType]?.id === updatedRecipe.id) {
                        newDayPlan[mealType] = updatedRecipe;
                        dayWasUpdated = true;
                    }
                }
    
                if (dayWasUpdated) {
                    newPlan.set(date, newDayPlan);
                    planWasUpdated = true;
                }
            }
        }

        return planWasUpdated ? newPlan : prevPlan;
    });
  }, []);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    setIsLoading(true);
    try {
        updateRecipeAndPlan(updatedRecipe);
        setIsAddRecipeModalOpen(false); // Close modal on success
    } catch (error) {
        console.error("Failed to update recipe:", error);
        alert("Could not update the recipe. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, [updateRecipeAndPlan]);
  
  const deleteRecipe = (baseRecipeId: string) => {
    setRecipes(prev => prev.filter(r => r.id !== baseRecipeId && r.baseRecipeId !== baseRecipeId));
  };

  const deleteAllRecipes = () => {
    setRecipes([]);
    setMealPlan(new Map());
    setShoppingList([]);
  };
  
  const bulkImportRecipes = async (
    sourceFile: File, 
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string) => void,
    onComplete: (count: number) => void
  ) => {
      try {
          let parsedRecipes: BulkParsedRecipe[] = [];

          if (importMode === 'meal_ideas') {
              onProgress('Reading meal ideas from file...');
              const documentText = await sourceFile.text();
              const ideas = documentText.split(/[\r\n]+/).filter(s => s.trim().length > 3);
              if (ideas.length === 0) throw new Error("No valid meal ideas found in the document.");
              onProgress(`Found ${ideas.length} ideas. Generating full recipes...`);
              parsedRecipes = await bulkGenerateAndAnalyzeRecipesWithGemini(ideas, RecipeCategory.Dinner, allTags.Dinner, settings.blacklistedIngredients);
          } else {
              onProgress(`Sending ${sourceFile.name} to AI for processing...`);
              parsedRecipes = await bulkParseRecipesFromFileWithGemini(sourceFile, allTags.Dinner, settings.blacklistedIngredients);
          }

          if (parsedRecipes.length === 0) {
              throw new Error("AI did not return any valid recipes from the document.");
          }
          
          onProgress(`AI returned ${parsedRecipes.length} recipes. Checking for duplicates and adjusting servings...`);

          const uniqueNewRecipes: Recipe[] = [];
          const skippedRecipes: string[] = [];
          const targetServings = settings.numberOfPeople * settings.servingsPerPerson;
          
          let count = 0;
          for (const data of parsedRecipes) {
              count++;
              onProgress(`Processing ${count} of ${parsedRecipes.length}: ${data.name}`);
              
              const { isDuplicate, similarRecipeName } = await checkForDuplicatesWithGemini(data, [...recipes, ...uniqueNewRecipes]);
              if (isDuplicate) {
                  skippedRecipes.push(`${data.name} (similar to ${similarRecipeName})`);
              } else {
                  let finalRecipeData = data;
                  if (finalRecipeData.servings !== targetServings && targetServings > 0) {
                      onProgress(`Adjusting servings for "${finalRecipeData.name}" to ${targetServings}...`);
                      const prompt = `Adjust this recipe from ${finalRecipeData.servings} servings to ${targetServings} servings. Update ingredient quantities and instructions accordingly.`;
                      try {
                           finalRecipeData = await editRecipeWithGemini(finalRecipeData as any as Recipe, prompt, settings.blacklistedIngredients);
                      } catch (error) {
                           console.error(`Failed to auto-adjust servings for ${finalRecipeData.name}. Importing with original servings.`, error);
                           onProgress(`Couldn't adjust servings for "${finalRecipeData.name}", using original.`);
                      }
                  }

                  uniqueNewRecipes.push({
                      id: `recipe_${Date.now()}_${uniqueNewRecipes.length}`,
                      ...finalRecipeData,
                      rating: 5,
                  });
              }
          }

          onProgress(`${uniqueNewRecipes.length} new recipes found. ${skippedRecipes.length} duplicates were skipped. Adding to your collection...`);

          setRecipes(prev => [...prev, ...uniqueNewRecipes]);
          onComplete(uniqueNewRecipes.length);

      } catch (error: any) {
          console.error(`Bulk import failed:`, error);
          throw error;
      }
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
    setIsAddRecipeModalOpen(true);
  };
  
  const handleOpenAddRecipeModal = () => {
    setRecipeToEdit(undefined);
    setIsAddRecipeModalOpen(true);
  }

  const handleAdjustServings = async (recipe: Recipe, newServings: number): Promise<BulkParsedRecipe | null> => {
      setIsLoading(true);
      try {
          const prompt = `Adjust this recipe from ${recipe.servings} servings to ${newServings} servings. Update ingredient quantities and instructions accordingly.`;
          const aiData = await editRecipeWithGemini(recipe, prompt, settings.blacklistedIngredients);
          return aiData;
      } catch (error) {
          console.error("Failed to adjust servings:", error);
          return null;
      } finally {
          setIsLoading(false);
      }
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
                  onAiEditMeal={handleEditRecipe}
                />;
      case 'shopping':
        return <ShoppingListView 
                  shoppingList={shoppingList}
                  setShoppingList={setShoppingList}
                  settings={settings}
               />;
      case 'meals':
        return <MealsView 
                  recipes={recipes} 
                  addRecipe={addRecipe}
                  updateRecipe={updateRecipe}
                  deleteRecipe={deleteRecipe}
                  deleteAllRecipes={deleteAllRecipes}
                  isLoading={isLoading}
                  allTags={allTags}
                  bulkImportRecipes={bulkImportRecipes}
                  onEnterKitchenMode={setKitchenModeRecipe}
                  handleEditRecipe={handleEditRecipe}
                  onOpenAddRecipeModal={handleOpenAddRecipeModal}
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
            <Header activeTab={activeTab} setActiveTab={handleTabChange} />
            <main className="mt-6 bg-white p-6 rounded-lg shadow-sm">
                <div key={animationKey} className="fade-in">
                    {renderContent()}
                </div>
            </main>
        </div>
        {kitchenModeRecipe && <KitchenModeView recipe={kitchenModeRecipe} onClose={() => setKitchenModeRecipe(null)} settings={settings} onAdjustServings={handleAdjustServings} />}
        {editMealDetails && (
            <EditMealModal
                onClose={() => setEditMealDetails(null)}
                onSave={(mealType, newRecipe) => {
                    setMealPlan(prev => {
                        const newPlan = new Map(prev);
                        const dayPlan = newPlan.get(editMealDetails.date);
                        if (dayPlan && typeof dayPlan === 'object') {
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
        {isAddRecipeModalOpen && (
            <AddRecipeModal
                onClose={() => setIsAddRecipeModalOpen(false)}
                onAddRecipe={addRecipe}
                onUpdateRecipe={updateRecipe}
                isLoading={isLoading}
                allTags={allTags}
                recipeToEdit={recipeToEdit}
                settings={settings}
            />
        )}
    </div>
  );
};

export default App;
