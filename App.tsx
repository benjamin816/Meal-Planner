import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tab, MealPlan, EatenLog, Settings, Recipe, RecipeCategory, RecipeTag, PlannedMeal, GeneratedRecipeData, MealType, BulkParsedRecipe, NutritionGoals, ShoppingListCategory, ShoppingListItem, UsageIntensity, SimilarityGroup } from './types';
import { TABS, DEFAULT_SETTINGS, DEFAULT_ALL_TAGS, INITIAL_RECIPES } from './constants';
import { analyzeRecipeWithGemini, generateMealPlanWithGemini, bulkParseRecipesFromFileWithGemini, bulkGenerateAndAnalyzeRecipesWithGemini, editRecipeWithGemini, checkForDuplicatesWithGemini, generateShoppingListWithGemini, findSimilarRecipesWithGemini } from './services/geminiService';
import Header from './components/Header';
import PlannerView from './components/PlannerView';
import ShoppingListView from './components/ShoppingListView';
import MealsView from './components/MealsView';
import LogView from './components/LogView';
import SettingsView from './components/SettingsView';
import KitchenModeView from './components/KitchenModeView';
import EditMealModal from './components/EditMealModal';
import AddRecipeModal from './components/AddRecipeModal';
import DuplicateDetectionModal from './components/DuplicateDetectionModal';
import { XIcon, ShoppingCartIcon } from './components/Icons';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [mealPlan, setMealPlan] = useState<MealPlan>(new Map());
  const [eatenLog, setEatenLog] = useState<EatenLog>(new Map());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allTags, setAllTags] = useState<Record<RecipeCategory, RecipeTag[]>>(DEFAULT_ALL_TAGS);
  const [shoppingList, setShoppingList] = useState<ShoppingListCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [kitchenModeContext, setKitchenModeContext] = useState<{ recipe: Recipe, portions?: number[] } | null>(null);
  const [editMealDetails, setEditMealDetails] = useState<{ date: string, type: MealType } | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | undefined>(undefined);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [showPlanSuccess, setShowPlanSuccess] = useState(false);
  const [similarityGroups, setSimilarityGroups] = useState<SimilarityGroup[] | null>(null);
  
  const currentImportRef = useRef<{ isCancelled: boolean } | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('mealPlannerSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings) as Settings);
      const savedTags = localStorage.getItem('mealPlannerTags');
      if (savedTags) setAllTags(JSON.parse(savedTags) as Record<RecipeCategory, RecipeTag[]>);
      
      const savedRecipes = localStorage.getItem('mealPlannerRecipes');
      if (savedRecipes) {
          setRecipes(JSON.parse(savedRecipes) as Recipe[]);
      } else {
          setRecipes(INITIAL_RECIPES);
      }

      const savedMealPlan = localStorage.getItem('mealPlannerPlan');
      if (savedMealPlan) setMealPlan(new Map(JSON.parse(savedMealPlan) as [string, PlannedMeal][]));
      const savedEatenLog = localStorage.getItem('mealPlannerEatenLog');
      if (savedEatenLog) setEatenLog(new Map(JSON.parse(savedEatenLog) as [string, Partial<Record<MealType, boolean>>][]));
      const savedShoppingList = localStorage.getItem('mealPlannerShoppingList');
      if (savedShoppingList) setShoppingList(JSON.parse(savedShoppingList) as ShoppingListCategory[]);
    } catch (error) {
      console.error("Failed to load data.", error);
    }
    setIsDataLoaded(true);
  }, []);

  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerSettings', JSON.stringify(settings)); }, [settings, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerTags', JSON.stringify(allTags)); }, [allTags, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerRecipes', JSON.stringify(recipes)); }, [recipes, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerPlan', JSON.stringify(Array.from(mealPlan.entries()))); }, [mealPlan, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerEatenLog', JSON.stringify(Array.from(eatenLog.entries()))); }, [eatenLog, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerShoppingList', JSON.stringify(shoppingList)); }, [shoppingList, isDataLoaded]);

  const generationPrerequisites = useMemo(() => {
    const availableBreakfasts = recipes.filter(r => r.category === RecipeCategory.Breakfast || r.isAlsoBreakfast).length;
    const availableSnacks = recipes.filter(r => r.category === RecipeCategory.Snack || r.isAlsoSnack).length;
    const availableDinners = recipes.filter(r => r.category === RecipeCategory.Dinner).length;
    
    const requiredBreakfasts = settings.breakfastsPerWeek;
    const requiredSnacks = settings.snacksPerWeek;
    const requiredDinners = settings.dinnersPerWeek;

    const missing = [];
    if (availableBreakfasts < requiredBreakfasts) missing.push(`${requiredBreakfasts - availableBreakfasts} more Breakfasts`);
    if (availableSnacks < requiredSnacks) missing.push(`${requiredSnacks - availableSnacks} more Snacks`);
    if (availableDinners < requiredDinners) missing.push(`${requiredDinners - availableDinners} more Dinners`);

    return {
      canGenerate: missing.length === 0,
      missingMessage: missing.length > 0 ? `To generate this plan, you need to add: ${missing.join(', ')} to your library.` : ""
    };
  }, [recipes, settings.breakfastsPerWeek, settings.snacksPerWeek, settings.dinnersPerWeek]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setAnimationKey(prev => prev + 1);
  };

  const handleMarkAsEaten = (date: string, mealType: MealType, eaten: boolean) => {
    setEatenLog(prev => {
        const newLog = new Map(prev);
        const dayLog = (newLog.get(date) || {}) as Partial<Record<MealType, boolean>>;
        dayLog[mealType] = eaten;
        if (Object.values(dayLog).every(v => !v)) newLog.delete(date); else newLog.set(date, dayLog);
        return newLog;
    });
  };

  const handleRemovePlannedMeal = (date: string, mealType: MealType) => {
    setMealPlan(prev => {
        const newPlan = new Map(prev);
        const day = newPlan.get(date);
        if (day) {
            // Fix: Cast day to PlannedMeal to satisfy object spread requirements in strict TypeScript environments
            const newDay = { ...(day as PlannedMeal) };
            delete newDay[mealType];
            newPlan.set(date, newDay);
        }
        return newPlan;
    });
  };
  
  const generatePlan = async (startDate: string, durationWeeks: number, dinnersPerWeek: number, breakfastsPerWeek: number, snacksPerWeek: number, drinkId?: string, drinkQty: number = 2) => {
    if (!generationPrerequisites.canGenerate) {
        alert(generationPrerequisites.missingMessage);
        return;
    }
    setIsLoading(true);
    setGenerationProgress(5);
    setGenerationStatus("Initializing AI Chef...");
    try {
      // Fix: Cast settings to Settings to satisfy object spread requirements
      const tempSettings = { ...(settings as Settings), planDurationWeeks: durationWeeks, dinnersPerWeek, breakfastsPerWeek, snacksPerWeek };
      const selectedDrink = recipes.find(r => r.id === drinkId);
      
      setGenerationProgress(15);
      setGenerationStatus("AI is mapping nutritional variety...");
      const newPlan: MealPlan = await generateMealPlanWithGemini(tempSettings, recipes, startDate, selectedDrink, drinkQty);
      
      setGenerationProgress(45);
      setGenerationStatus("Plan received. Scaling portions for your household...");
      
      setSettings(tempSettings);
      setMealPlan(new Map(newPlan));
      
      const recipeFrequencies = new Map<string, { r: Recipe, totalPortions: number }>();
      newPlan.forEach(day => {
          // Fix: Use a specific subset of PlannedMeal keys that are known to be Recipes to avoid union widening errors
          (['breakfast', 'lunch', 'dinner', 'snack'] as const).forEach(type => {
              const r = day[type];
              if (r && r.category !== RecipeCategory.Drink) {
                  const portionMultiplier = (day as any)[`${type}Portions`] || 1;
                  const data = recipeFrequencies.get(r.id) || { r, totalPortions: 0 };
                  recipeFrequencies.set(r.id, { ...data, totalPortions: data.totalPortions + (Array.isArray(portionMultiplier) ? portionMultiplier.reduce((a,b)=>a+b,0) : portionMultiplier) });
              }
          });
      });

      const frequencyEntries = Array.from(recipeFrequencies.values());
      const scaledRecipeIngredientsPromises = frequencyEntries.map(async ({ r, totalPortions }, index) => {
          await new Promise(res => setTimeout(res, index * 200));

          const totalServingsNeeded = totalPortions;
          const prompt = `Scale this recipe from 1 serving to exactly ${totalServingsNeeded.toFixed(2)} servings. Only update ingredients and quantities. Return just the ingredients list text.`;
          try {
              const result = await editRecipeWithGemini(r, prompt, tempSettings.blacklistedIngredients);
              setGenerationProgress(45 + (index / frequencyEntries.length) * 35);
              setGenerationStatus(`Scaling: ${r.name}...`);
              return { id: r.id, scaledIngredients: result.ingredients };
          } catch {
              return { id: r.id, scaledIngredients: r.ingredients + `\n(MULTIPLY BY ${totalServingsNeeded.toFixed(1)})` };
          }
      });

      const scaledIngredientsList = await Promise.all(scaledRecipeIngredientsPromises);
      const allScaledIngredients = scaledIngredientsList.map(s => s.scaledIngredients).join('\n');
      
      if (allScaledIngredients) {
          setGenerationProgress(85);
          setGenerationStatus("Organizing categorized shopping list...");
          const categorizedItems = await generateShoppingListWithGemini(allScaledIngredients);
          const finalShoppingList: ShoppingListCategory[] = categorizedItems.map((cat, idx) => ({
              id: `cat_${idx}_${Date.now()}`,
              name: cat.category,
              items: cat.items.map((item, iIdx) => ({
                  id: `item_${idx}_${iIdx}_${Date.now()}`,
                  name: item,
                  checked: false
              }))
          }));
          setShoppingList(finalShoppingList);
      }

      setGenerationProgress(100);
      setGenerationStatus("Plan finalized!");
      setShowPlanSuccess(true);
    } catch (error) {
      console.error(error); alert("An error occurred during plan generation.");
    } finally { 
      setIsLoading(false); 
      setGenerationProgress(0);
      setGenerationStatus("");
    }
  };

  const addRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
    setIsLoading(true);
    try {
        const { isDuplicate, similarRecipeName, reasoning } = await checkForDuplicatesWithGemini(recipeData, recipes);
        if (isDuplicate) { 
            alert(`Duplicate of "${similarRecipeName}".\n\nReason: ${reasoning}`); 
            setIsLoading(false);
            return; 
        }
        
        const analysis = await analyzeRecipeWithGemini(recipeData);
        const newRecipe: Recipe = { 
          id: `recipe_${Date.now()}_${Math.random()}`, 
          ...recipeData,
          ...analysis,
          tags: recipeData.tags || [],
          usageIntensity: recipeData.usageIntensity || analysis.usageIntensity || 'normal',
          servings: 1 
        };
        
        setRecipes(prev => [...prev, newRecipe]);
        setIsAddRecipeModalOpen(false);
    } catch (error) {
        console.error(error); 
        alert("Could not analyze and add recipe. Please try again.");
    } finally { 
        setIsLoading(false); 
    }
  }, [recipes, settings.blacklistedIngredients]);

  const updateRecipeAndPlan = useCallback((updatedRecipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    setMealPlan(prev => {
        const newPlan = new Map(prev);
        let updated = false;
        for (const [date, dayPlan] of newPlan.entries()) {
            if (dayPlan && typeof dayPlan === 'object') {
                // Fix: Cast dayPlan to PlannedMeal to satisfy object spread requirements
                const newDayPlan: PlannedMeal = { ...(dayPlan as PlannedMeal) };
                let dayUpdated = false;
                // Fix: Specifically type the meal types to ensure they index Recipe properties only, avoiding union widening errors
                const types: (keyof Pick<PlannedMeal, 'breakfast' | 'lunch' | 'dinner' | 'snack'>)[] = ['breakfast', 'lunch', 'dinner', 'snack'];
                for (const t of types) { 
                    if (newDayPlan[t]?.id === updatedRecipe.id) { 
                        newDayPlan[t] = updatedRecipe; 
                        dayUpdated = true; 
                    } 
                }
                if (dayUpdated) { newPlan.set(date, newDayPlan); updated = true; }
            }
        }
        return updated ? newPlan : prev;
    });
  }, []);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    setIsLoading(true);
    try { 
        updateRecipeAndPlan(updatedRecipe); 
        setIsAddRecipeModalOpen(false); 
    } catch (e) { 
        console.error(e); 
    } finally { 
        setIsLoading(false); 
    }
  }, [updateRecipeAndPlan]);

  const setDefaultDrink = (id: string) => {
    setRecipes(prev => prev.map(r => ({
        ...r,
        isDefaultDrink: r.id === id ? true : (r.category === RecipeCategory.Drink ? false : r.isDefaultDrink)
    })));
  };
  
  const deleteRecipe = (id: string) => { setRecipes(prev => prev.filter(r => r.id !== id && r.baseRecipeId !== id)); };
  const deleteAllRecipes = () => { setRecipes([]); setMealPlan(new Map()); setShoppingList([]); };
  
  const bulkImportRecipes = async (
    sourceFile: File, 
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string, percentage: number) => void,
    onComplete: (count: number) => void,
    onAbortSignal: { isCancelled: boolean }
  ) => {
      currentImportRef.current = onAbortSignal;
      try {
          const userGoals = settings.people[0].goals;
          let parsedRecipes: BulkParsedRecipe[] = [];

          if (importMode === 'meal_ideas') {
              onProgress('Reading ideas...', 5);
              const text = await sourceFile.text();
              const ideas = text.split(/[\r\n]+/).filter(s => s.trim().length > 3);
              if (ideas.length === 0) throw new Error("No ideas found.");
              if (onAbortSignal.isCancelled) return;
              onProgress(`Found ${ideas.length} ideas. Generating 1-serving recipes...`, 10);
              parsedRecipes = await bulkGenerateAndAnalyzeRecipesWithGemini(ideas, RecipeCategory.Dinner, settings.blacklistedIngredients, 1, userGoals);
          } else {
              onProgress(`Sending to AI for smart 1-serving parsing...`, 10);
              parsedRecipes = await bulkParseRecipesFromFileWithGemini(sourceFile, settings.blacklistedIngredients, 1, userGoals);
          }

          if (onAbortSignal.isCancelled) return;
          if (parsedRecipes.length === 0) throw new Error("No recipes returned.");
          
          onProgress(`Processing ${parsedRecipes.length} recipes...`, 60);

          const uniqueNewRecipes: Recipe[] = [];
          for (let i = 0; i < parsedRecipes.length; i++) {
              if (onAbortSignal.isCancelled) return;
              await new Promise(res => setTimeout(res, 500));

              const data = parsedRecipes[i];
              const percentage = 60 + Math.round((i / parsedRecipes.length) * 40);
              onProgress(`Verifying: ${data.name}`, percentage);
              const { isDuplicate } = await checkForDuplicatesWithGemini(data, [...recipes, ...uniqueNewRecipes]);
              if (!isDuplicate) {
                  uniqueNewRecipes.push({ 
                    id: `recipe_${Date.now()}_${uniqueNewRecipes.length}_${Math.random()}`, 
                    ...data, 
                    tags: data.tags || [],
                    usageIntensity: data.usageIntensity || 'normal',
                    servings: 1
                  });
              }
          }

          if (onAbortSignal.isCancelled) return;
          setRecipes(prev => [...prev, ...uniqueNewRecipes]);
          onComplete(uniqueNewRecipes.length);
      } catch (error: any) {
          if (!onAbortSignal.isCancelled) { console.error(error); throw error; }
      }
  };

  const handleDetectSimilar = async () => {
    setIsLoading(true);
    try {
        const groups = await findSimilarRecipesWithGemini(recipes);
        setSimilarityGroups(groups);
    } catch (error) {
        console.error(error);
        alert("Failed to scan for similar recipes.");
    } finally {
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab.id) {
      case 'planner': return (
        <PlannerView 
            mealPlan={mealPlan} 
            eatenLog={eatenLog} 
            recipes={recipes}
            settings={settings}
            generatePlan={generatePlan} 
            isLoading={isLoading} 
            generationProgress={generationProgress}
            generationStatus={generationStatus}
            onMarkAsEaten={handleMarkAsEaten} 
            onRemovePlannedMeal={handleRemovePlannedMeal}
            onSwapPlannedMeal={(date, type) => setEditMealDetails({date, type})}
            onAddPlannedMeal={(date, type) => setEditMealDetails({date, type})}
            setActiveTab={setActiveTab} 
            onViewRecipe={(recipe, portions) => setKitchenModeContext({ recipe, portions })}
            hasShoppingItems={shoppingList.length > 0} 
            generationPrerequisites={generationPrerequisites} 
            defaultUniqueSettings={{ dinners: settings.dinnersPerWeek, breakfasts: settings.breakfastsPerWeek, snacks: settings.snacksPerWeek }} 
        />
      );
      case 'shopping': return <ShoppingListView shoppingList={shoppingList} setShoppingList={setShoppingList} settings={settings} />;
      case 'meals': return <MealsView recipes={recipes} addRecipe={addRecipe} updateRecipe={updateRecipe} deleteRecipe={deleteRecipe} deleteAllRecipes={deleteAllRecipes} isLoading={isLoading} allTags={allTags} bulkImportRecipes={bulkImportRecipes} onEnterKitchenMode={r => setKitchenModeContext({ recipe: r })} handleEditRecipe={r => { setRecipeToEdit(r); setIsAddRecipeModalOpen(true); }} onOpenAddRecipeModal={() => { setRecipeToEdit(undefined); setIsAddRecipeModalOpen(true); }} onDetectSimilar={handleDetectSimilar} onSetDefaultDrink={setDefaultDrink} />;
      case 'log': return <LogView eatenLog={eatenLog} mealPlan={mealPlan} />;
      case 'settings': return <SettingsView settings={settings} onSettingsChange={setSettings} allTags={allTags} onAllTagsChange={setAllTags} recipes={recipes} onBulkUpdateRecipes={setRecipes} />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex flex-col">
        <div className="container mx-auto p-4 md:p-6 flex-grow">
            <Header activeTab={activeTab} setActiveTab={handleTabChange} />
            <main className="mt-6 bg-white p-6 rounded-lg shadow-sm">
                <div key={animationKey} className="fade-in">{renderContent()}</div>
            </main>
        </div>
        
        <footer className="container mx-auto px-4 md:px-6 pb-4 flex justify-between items-center text-[10px] text-gray-400 font-mono">
            <div>v13.3</div>
            <div>{new Date().toLocaleString()}</div>
        </footer>

        {kitchenModeContext && (
            <KitchenModeView 
                recipe={kitchenModeContext.recipe} 
                portions={kitchenModeContext.portions}
                settings={settings}
                onClose={() => setKitchenModeContext(null)} 
            />
        )}
        {editMealDetails && (
            <EditMealModal 
                onClose={() => setEditMealDetails(null)} 
                onSave={(type, rec) => { 
                    setMealPlan(prev => { 
                        const newPlan = new Map(prev); 
                        const day = (newPlan.get(editMealDetails.date) || {}) as PlannedMeal; 
                        newPlan.set(editMealDetails.date, { ...day, [type]: rec }); 
                        return newPlan; 
                    }); 
                    setEditMealDetails(null); 
                }} 
                recipes={recipes} 
                dayPlan={mealPlan.get(editMealDetails.date) || {}} 
                date={editMealDetails.date}
                forcedType={editMealDetails.type}
            />
        )}
        {isAddRecipeModalOpen && <AddRecipeModal onClose={() => setIsAddRecipeModalOpen(false)} onAddRecipe={addRecipe} onUpdateRecipe={updateRecipe} isLoading={isLoading} allTags={allTags} recipeToEdit={recipeToEdit} settings={settings} />}
        
        {similarityGroups && (
            <DuplicateDetectionModal 
                groups={similarityGroups} 
                recipes={recipes} 
                onClose={() => setSimilarityGroups(null)} 
                onDeleteRecipe={deleteRecipe}
            />
        )}

        {showPlanSuccess && (
            <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-gray-100 flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-gray-100 bg-green-50/50 flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-2xl font-black text-gray-800 tracking-tight">Your Meal Plan is Ready! 🎉</h3>
                            <p className="text-xs font-bold text-green-600 uppercase tracking-widest mt-1"> Allocated based on Daily Slots</p>
                        </div>
                        <button onClick={() => setShowPlanSuccess(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors shrink-0"><XIcon className="w-6 h-6"/></button>
                    </div>
                    
                    <div className="p-6 space-y-8 overflow-y-auto flex-grow">
                        {(() => {
                            const summary = {
                                'Dinner Slots': new Map<string, {r: Recipe, c: number}>(),
                                'Breakfast Slots': new Map<string, {r: Recipe, c: number}>(),
                                'Snack Slots': new Map<string, {r: Recipe, c: number}>(),
                                'Lunch Slots': new Map<string, {r: Recipe, c: number}>()
                            };

                            mealPlan.forEach((day) => {
                                (['breakfast', 'snack', 'dinner', 'lunch'] as const).forEach((type) => {
                                    const r = day[type as keyof PlannedMeal];
                                    if (r instanceof Object && 'category' in r) { // Additional runtime check for safety
                                        const catKeyMap: Record<string, string> = {
                                            'breakfast': 'Breakfast Slots',
                                            'snack': 'Snack Slots',
                                            'dinner': 'Dinner Slots',
                                            'lunch': 'Lunch Slots'
                                        };
                                        const catKey = catKeyMap[type];
                                        const recipe = r as Recipe;
                                        const existing = summary[catKey as keyof typeof summary].get(recipe.id) || { r: recipe, c: 0 };
                                        summary[catKey as keyof typeof summary].set(recipe.id, { ...existing, c: existing.c + 1 });
                                    }
                                });
                            });

                            return Object.entries(summary).map(([title, recipes]) => recipes.size > 0 && (
                                <div key={title}>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 border-b pb-1">{title} Filled</h4>
                                    <div className="space-y-2">
                                        {Array.from(recipes.values()).map(({ r, c }) => (
                                            <div key={r.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex-grow pr-4">
                                                    <p className="text-sm font-black text-gray-800 line-clamp-1">{r.name}</p>
                                                </div>
                                                <div className="shrink-0 bg-white px-3 py-1 rounded-lg border border-gray-200 text-center min-w-[80px]">
                                                    <p className="text-[10px] font-black text-blue-600 leading-none">{c}</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Planned Meals</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className="p-6 border-t bg-gray-50 shrink-0">
                        <button 
                            onClick={() => { setActiveTab({id: 'shopping', label: 'Shopping List'}); setShowPlanSuccess(false); }}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 transform active:scale-90"
                        >
                            <ShoppingCartIcon className="w-5 h-5" />
                            VIEW SHOPPING LIST
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;