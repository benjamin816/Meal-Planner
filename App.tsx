import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tab, MealPlan, EatenLog, Settings, Recipe, RecipeCategory, RecipeTag, PlannedMeal, GeneratedRecipeData, MealType, BulkParsedRecipe, NutritionGoals, ShoppingListCategory, ShoppingListItem, UsageIntensity, SimilarityGroup } from './types';
import { TABS, DEFAULT_SETTINGS, DEFAULT_ALL_TAGS, INITIAL_RECIPES } from './constants';
import { analyzeRecipeWithGemini, generateMealPlanWithGemini, bulkParseRecipesFromFileWithGemini, bulkGenerateAndAnalyzeRecipesWithGemini, editRecipeWithGemini, generateShoppingListWithGemini, findSimilarRecipesWithGemini } from './services/geminiService';
import { fetchStateFromSheets, isSheetsSyncConfigured, saveStateToSheets, SheetAppState } from './services/sheetsSyncService';
import Header from './components/Header';
import PlannerView from './components/PlannerView';
import ShoppingListView from './components/ShoppingListView';
import MealsView from './components/MealsView';
import LogView from './components/LogView';
import SettingsView from './components/SettingsView';
import KitchenModeView from './components/KitchenModeView';
import EditMealModal from './components/EditMealModal';
import AddRecipeModal from './components/AddRecipeModal';
import { XIcon, ShoppingCartIcon, TrashIcon, CheckIcon } from './components/Icons';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [mealPlan, setMealPlan] = useState<MealPlan>(new Map());
  const [eatenLog, setEatenLog] = useState<EatenLog>(new Map());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [binRecipes, setBinRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allTags, setAllTags] = useState<Record<RecipeCategory, RecipeTag[]>>(DEFAULT_ALL_TAGS);
  const [shoppingList, setShoppingList] = useState<ShoppingListCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [kitchenModeContext, setKitchenModeContext] = useState<{ recipe: Recipe, portions?: number[], totalPlanPortions?: number[] } | null>(null);
  const [editMealDetails, setEditMealDetails] = useState<{ date: string, type: MealType } | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | undefined>(undefined);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [similarityGroups, setSimilarityGroups] = useState<SimilarityGroup[]>([]);
  
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'delete', undoAction?: () => void } | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const hydrateFromState = (state: SheetAppState) => {
      if (isCancelled) return;
      setSettings(state.settings || DEFAULT_SETTINGS);
      setAllTags(state.allTags || DEFAULT_ALL_TAGS);
      setRecipes(state.recipes?.length ? state.recipes : INITIAL_RECIPES);
      setBinRecipes(state.binRecipes || []);
      setMealPlan(new Map(state.mealPlanEntries || []));
      setEatenLog(new Map(state.eatenLogEntries || []));
      setShoppingList(state.shoppingList || []);
    };

    const load = async () => {
      try {
        const savedSettings = localStorage.getItem('mealPlannerSettings');
        if (savedSettings && !isCancelled) setSettings(JSON.parse(savedSettings) as Settings);
        const savedTags = localStorage.getItem('mealPlannerTags');
        if (savedTags && !isCancelled) setAllTags(JSON.parse(savedTags) as Record<RecipeCategory, RecipeTag[]>);
        const savedRecipes = localStorage.getItem('mealPlannerRecipes');
        if (!isCancelled) {
          if (savedRecipes) setRecipes(JSON.parse(savedRecipes) as Recipe[]);
          else setRecipes(INITIAL_RECIPES);
        }
        const savedBin = localStorage.getItem('mealPlannerBin');
        if (savedBin && !isCancelled) setBinRecipes(JSON.parse(savedBin) as Recipe[]);
        const savedMealPlan = localStorage.getItem('mealPlannerPlan');
        if (savedMealPlan && !isCancelled) setMealPlan(new Map(JSON.parse(savedMealPlan) as [string, PlannedMeal][]));
        const savedEatenLog = localStorage.getItem('mealPlannerEatenLog');
        if (savedEatenLog && !isCancelled) setEatenLog(new Map(JSON.parse(savedEatenLog) as [string, Partial<Record<MealType, boolean>>][]));
        const savedShoppingList = localStorage.getItem('mealPlannerShoppingList');
        if (savedShoppingList && !isCancelled) setShoppingList(JSON.parse(savedShoppingList) as ShoppingListCategory[]);
      } catch (e) {
        console.error(e);
      }

      if (isSheetsSyncConfigured()) {
        try {
          const remoteState = await fetchStateFromSheets();
          if (remoteState) hydrateFromState(remoteState);
        } catch (error) {
          console.error('Google Sheets sync load failed. Falling back to local data.', error);
        }
      }

      if (!isCancelled) setIsDataLoaded(true);
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerSettings', JSON.stringify(settings)); }, [settings, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerTags', JSON.stringify(allTags)); }, [allTags, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerRecipes', JSON.stringify(recipes)); }, [recipes, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerBin', JSON.stringify(binRecipes)); }, [binRecipes, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerPlan', JSON.stringify(Array.from(mealPlan.entries()))); }, [mealPlan, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerEatenLog', JSON.stringify(Array.from(eatenLog.entries()))); }, [eatenLog, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerShoppingList', JSON.stringify(shoppingList)); }, [shoppingList, isDataLoaded]);
  useEffect(() => {
    if (!isDataLoaded || !isSheetsSyncConfigured()) return;

    const state: SheetAppState = {
      settings,
      allTags,
      recipes,
      binRecipes,
      mealPlanEntries: Array.from(mealPlan.entries()),
      eatenLogEntries: Array.from(eatenLog.entries()),
      shoppingList,
    };

    const timer = window.setTimeout(() => {
      void saveStateToSheets(state).catch((error) => {
        console.error('Google Sheets sync save failed.', error);
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [settings, allTags, recipes, binRecipes, mealPlan, eatenLog, shoppingList, isDataLoaded]);
  useEffect(() => () => {
    if (notificationTimeoutRef.current) window.clearTimeout(notificationTimeoutRef.current);
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'delete', undoAction?: () => void) => {
    if (notificationTimeoutRef.current) window.clearTimeout(notificationTimeoutRef.current);
    setNotification({ message, type, undoAction });
    notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), 5000);
  }, []);

  const updateShoppingListFromPlan = useCallback(async (currentPlan: MealPlan) => {
    if (currentPlan.size === 0) {
        setShoppingList([]);
        return;
    }
    setGenerationStatus("Re-calculating shopping list...");
    const recipeFrequencies = new Map<string, { r: Recipe, totalPortions: number }>();
    currentPlan.forEach(day => {
        (['breakfast', 'lunch', 'dinner', 'snack'] as const).forEach(type => {
            const r = day[type];
            if (r && r.category !== RecipeCategory.Drink) {
                const portions = (day as any)[`${type}Portions`] as number[] || [1];
                const data = recipeFrequencies.get(r.id) || { r, totalPortions: 0 };
                recipeFrequencies.set(r.id, { ...data, totalPortions: data.totalPortions + portions.reduce((a,b)=>a+b,0) });
            }
        });
    });

    const frequencyEntries = Array.from(recipeFrequencies.values());
    if (frequencyEntries.length === 0) {
        setShoppingList([]);
        setGenerationStatus("");
        return;
    }

    const scaledPromises = frequencyEntries.map(async ({ r, totalPortions }) => {
        const prompt = `Scale ingredients to exactly ${totalPortions.toFixed(2)} servings. Return just the ingredients text.`;
        try {
            const res = await editRecipeWithGemini(r, prompt, settings);
            return `[${r.name}]: ${res.ingredients}`;
        } catch { return `[${r.name}]: ${r.ingredients} (x${totalPortions})`; }
    });
    const allScaledText = (await Promise.all(scaledPromises)).join('\n');
    const categorized = await generateShoppingListWithGemini(allScaledText);
    const final: ShoppingListCategory[] = categorized.map((cat, idx) => ({
        id: `cat_${idx}_${Date.now()}`,
        name: cat.category,
        items: cat.items.map((item, iIdx) => ({ 
            id: `item_${idx}_${iIdx}_${Date.now()}`, 
            name: item.name, 
            checked: false,
            sources: item.sources 
        }))
    }));
    setShoppingList(final);
    setGenerationStatus("");
  }, [settings]);

  const refreshShoppingList = useCallback((plan: MealPlan) => {
    void updateShoppingListFromPlan(plan).catch((error) => {
      console.error(error);
      setGenerationStatus("");
      showNotification("Shopping list update failed. Please try again.", "delete");
    });
  }, [updateShoppingListFromPlan, showNotification]);

  const openKitchenMode = useCallback((recipe: Recipe, currentDayPortions?: number[]) => {
      // Calculate total portions for this recipe across the entire meal plan
      const totalAcrossPlan = new Array(settings.people.length).fill(0);
      let foundInPlan = false;

      mealPlan.forEach((day) => {
          (['breakfast', 'lunch', 'snack', 'dinner'] as const).forEach((type) => {
              if (day[type]?.id === recipe.id) {
                  foundInPlan = true;
                  const portions = (day as any)[`${type}Portions`] as number[] | undefined;
                  if (portions) {
                      portions.forEach((p, idx) => {
                          totalAcrossPlan[idx] += p;
                      });
                  }
              }
          });
      });

      setKitchenModeContext({ 
          recipe, 
          portions: currentDayPortions, 
          totalPlanPortions: foundInPlan ? totalAcrossPlan : undefined 
      });
  }, [mealPlan, settings.people.length]);

  const clearDayPlan = useCallback((date: string) => {
    setMealPlan(prev => {
        const next = new Map(prev);
        if (next.has(date)) {
            next.delete(date);
            refreshShoppingList(next);
        }
        return next;
    });
    showNotification(`Cleared plan for ${date}`, 'delete');
  }, [refreshShoppingList, showNotification]);

  const generatePlan = async (
    startDate: string, 
    durationWeeks: number, 
    dinnersPerWeek: number, 
    breakfastsPerWeek: number, 
    snacksPerWeek: number, 
    drinkId?: string, 
    drinkQty: number = 2,
    mandatoryRecipeIds?: string[]
  ) => {
    setIsLoading(true);
    setGenerationProgress(12);
    setGenerationStatus("Consulting AI Chef...");
    
    const progressTimer = window.setInterval(() => {
      setGenerationProgress(prev => {
        const nextProgress = prev < 90 ? prev + 0.8 : prev;

        if (nextProgress > 15 && nextProgress < 40) setGenerationStatus("Optimizing caloric distribution...");
        else if (nextProgress >= 40 && nextProgress < 70) setGenerationStatus("Drafting variety-rich meal schedule...");
        else if (nextProgress >= 70 && nextProgress < 85) setGenerationStatus("Validating portions for each person...");
        else if (nextProgress >= 85) setGenerationStatus("Ensuring dinner is the largest meal...");

        return nextProgress;
      });
    }, 400);

    try {
      const tempSettings = { ...settings, planDurationWeeks: durationWeeks, dinnersPerWeek, breakfastsPerWeek, snacksPerWeek };
      const selectedDrink = recipes.find(r => r.id === drinkId);
      const newPlan = await generateMealPlanWithGemini(tempSettings, recipes, startDate, selectedDrink, drinkQty, mandatoryRecipeIds);
      
      clearInterval(progressTimer);
      setGenerationProgress(92);
      setGenerationStatus("Finalizing portions and shopping list...");
      
      setSettings(tempSettings);
      setMealPlan(new Map(newPlan));
      await updateShoppingListFromPlan(newPlan);
      
      setGenerationProgress(100);
    } catch (e) { 
        console.error(e); 
        clearInterval(progressTimer);
        showNotification("Plan generation failed. Please try again.", "delete");
    } finally { 
        setIsLoading(false); 
        setGenerationProgress(0); 
        setGenerationStatus(""); 
    }
  };

  const bulkImportRecipes = useCallback(async (
    sourceFile: File,
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string, percentage: number) => void,
    onComplete: (count: number) => void,
    abortSignal: { isCancelled: boolean }
  ) => {
    try {
        onProgress("Reading file content...", 10);
        const text = await sourceFile.text();
        if (abortSignal.isCancelled) return;

        let parsed: BulkParsedRecipe[] = [];
        if (importMode === 'full_recipes') {
            onProgress("Gemini is extracting recipes...", 30);
            parsed = await bulkParseRecipesFromFileWithGemini(
                sourceFile, 
                settings.blacklistedIngredients, 
                settings.minimalIngredients, 
                1, 
                settings.people[0].goals
            );
        } else {
            onProgress("Gemini is generating recipes from ideas...", 30);
            const ideas = text.split('\n').filter(l => l.trim().length > 3).slice(0, 10);
            parsed = await bulkGenerateAndAnalyzeRecipesWithGemini(
                ideas, 
                RecipeCategory.Dinner, 
                settings, 
                1, 
                settings.people[0].goals
            );
        }

        if (abortSignal.isCancelled) return;
        onProgress("Saving to library...", 90);
        
        const recipesToAdd: Recipe[] = parsed.map(p => ({
            ...p,
            id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tags: p.tags || []
        }));

        setRecipes(prev => [...prev, ...recipesToAdd]);
        onComplete(recipesToAdd.length);
        showNotification(`Imported ${recipesToAdd.length} recipes.`, 'success');
    } catch (error) {
        console.error(error);
        throw new Error("Bulk import failed. Please check your file and try again.");
    }
  }, [settings, showNotification]);

  const onDetectSimilar = useCallback(async () => {
    setIsLoading(true);
    try {
        const groups = await findSimilarRecipesWithGemini(recipes);
        setSimilarityGroups(groups);
        if (groups.length === 0) {
            showNotification("No duplicate recipes detected.", "success");
        }
    } catch (error) {
        console.error(error);
        showNotification("Duplicate detection failed.", "delete");
    } finally {
        setIsLoading(false);
    }
  }, [recipes, showNotification]);

  const addRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
    setIsLoading(true);
    try {
        const analyzed = await analyzeRecipeWithGemini(recipeData, settings);
        const newRecipe: Recipe = {
            ...recipeData,
            ...analyzed,
            id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tags: []
        };
        setRecipes(prev => [...prev, newRecipe]);
        showNotification("Recipe added successfully.", 'success');
    } catch (error) {
        console.error(error);
        showNotification("Failed to analyze recipe.", "delete");
    } finally {
        setIsLoading(false);
    }
  }, [settings, showNotification]);

  const updateRecipe = useCallback(async (recipe: Recipe) => {
      setIsLoading(true);
      try {
          const analyzed = await analyzeRecipeWithGemini(recipe, settings);
          setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...recipe, ...analyzed } : r));
          showNotification("Recipe updated.", 'success');
      } catch (error) {
          console.error(error);
          showNotification("Update failed.", "delete");
      } finally {
          setIsLoading(false);
      }
  }, [settings, showNotification]);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes(prev => {
        const toDelete = prev.find(r => r.id === id);
        if (toDelete) {
            const recipeToBin = Object.assign({}, toDelete, { deletedAt: new Date().toISOString() });
            setBinRecipes(b => [recipeToBin, ...b]);
        }
        return prev.filter(r => r.id !== id);
    });
    showNotification("Recipe moved to bin.", 'delete');
  }, [showNotification]);

  const restoreRecipe = useCallback((id: string) => {
    setBinRecipes(prev => {
        const toRestore = prev.find(r => r.id === id);
        if (toRestore) {
            const { deletedAt, ...rest } = toRestore as any;
            setRecipes(r => [...r, rest as Recipe]);
        }
        return prev.filter(r => r.id !== id);
    });
    showNotification("Recipe restored.", 'success');
  }, [showNotification]);

  const restoreAllRecipes = useCallback(() => {
    setRecipes(prev => {
        const restored = binRecipes.map(br => {
            const { deletedAt, ...rest } = br as any;
            return rest as Recipe;
        });
        return [...prev, ...restored];
    });
    setBinRecipes([]);
    showNotification("All recipes restored.", 'success');
  }, [binRecipes, showNotification]);

  const permanentDeleteFromBin = useCallback((id: string) => {
    setBinRecipes(prev => prev.filter(r => r.id !== id));
    showNotification("Recipe permanently deleted.", 'delete');
  }, [showNotification]);

  const deleteAllRecipes = useCallback(() => {
    setRecipes([]);
    setBinRecipes([]);
    setMealPlan(new Map());
    setShoppingList([]);
    showNotification("Library wiped.", 'delete');
  }, [showNotification]);

  const markAsEaten = useCallback((date: string, type: MealType, eaten: boolean) => {
    setEatenLog(prev => {
        const next = new Map(prev);
        const day = next.get(date) || {};
        day[type] = eaten;
        next.set(date, day);
        return next;
    });
  }, []);

  const removePlannedMeal = useCallback((date: string, type: MealType) => {
    setMealPlan(prev => {
        const next = new Map(prev);
        const day = next.get(date);
        if (day) {
            (day as any)[type] = undefined;
            (day as any)[`${type}Portions`] = undefined;
            next.set(date, day);
            refreshShoppingList(next);
        }
        return next;
    });
  }, [refreshShoppingList]);

  const swapPlannedMeal = useCallback((date: string, type: MealType) => {
      setEditMealDetails({ date, type });
  }, []);

  const onSaveMealEdit = useCallback((type: MealType, newRecipe: Recipe, mode: 'swap_days' | 'replace_all' | 'replace_single', swapDate?: string) => {
      setMealPlan(prev => {
          const next = new Map(prev);
          const currentDay = next.get(editMealDetails!.date);
          
          if (mode === 'swap_days' && swapDate) {
              const otherDay = next.get(swapDate);
              if (currentDay && otherDay) {
                  const currentRecipe = (currentDay as any)[type];
                  const currentPortions = (currentDay as any)[`${type}Portions`];
                  const otherRecipe = (otherDay as any)[type];
                  const otherPortions = (otherDay as any)[`${type}Portions`];
                  
                  (currentDay as any)[type] = otherRecipe;
                  (currentDay as any)[`${type}Portions`] = otherPortions;
                  (otherDay as any)[type] = currentRecipe;
                  (otherDay as any)[`${type}Portions`] = currentPortions;
                  
                  next.set(editMealDetails!.date, Object.assign({}, currentDay));
                  next.set(swapDate, Object.assign({}, otherDay));
              }
          } else if (mode === 'replace_single') {
              if (currentDay) {
                  (currentDay as any)[type] = newRecipe;
                  (currentDay as any)[`${type}Portions`] = settings.people.map(() => 1);
                  next.set(editMealDetails!.date, Object.assign({}, currentDay));
              }
          } else if (mode === 'replace_all') {
              const oldRecipeId = (currentDay as any)[type]?.id;
              next.forEach((day, dStr) => {
                  (['breakfast', 'lunch', 'dinner', 'snack'] as const).forEach(mType => {
                      if ((day as any)[mType]?.id === oldRecipeId) {
                          (day as any)[mType] = newRecipe;
                      }
                  });
              });
          }
          
          refreshShoppingList(next);
          return next;
      });
      setEditMealDetails(null);
  }, [editMealDetails, refreshShoppingList, settings.people]);

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" key={animationKey}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="mt-8">
        {activeTab.id === 'planner' && (
          <PlannerView 
            mealPlan={mealPlan} 
            eatenLog={eatenLog} 
            recipes={recipes} 
            settings={settings}
            generatePlan={generatePlan}
            isLoading={isLoading}
            generationProgress={generationProgress}
            generationStatus={generationStatus}
            onMarkAsEaten={markAsEaten}
            onRemovePlannedMeal={removePlannedMeal}
            onSwapPlannedMeal={swapPlannedMeal}
            onAddPlannedMeal={(date, type) => setEditMealDetails({ date, type })}
            setActiveTab={setActiveTab}
            onViewRecipe={openKitchenMode}
            hasShoppingItems={shoppingList.length > 0}
            generationPrerequisites={{
                canGenerate: recipes.filter(r => r.category === RecipeCategory.Dinner).length >= settings.dinnersPerWeek,
                missingMessage: `You need at least ${settings.dinnersPerWeek} dinner recipes in your library to generate a plan.`
            }}
            defaultUniqueSettings={{
                dinners: settings.dinnersPerWeek,
                breakfasts: settings.breakfastsPerWeek,
                snacks: settings.snacksPerWeek
            }}
            showPlanSuccess={false}
            setShowPlanSuccess={() => {}}
          />
        )}
        
        {activeTab.id === 'shopping' && (
          <ShoppingListView 
            shoppingList={shoppingList} 
            setShoppingList={setShoppingList} 
            settings={settings}
          />
        )}
        
        {activeTab.id === 'meals' && (
          <MealsView 
            recipes={recipes} 
            binRecipes={binRecipes}
            settings={settings}
            addRecipe={addRecipe}
            updateRecipe={updateRecipe}
            deleteRecipe={deleteRecipe}
            restoreRecipe={restoreRecipe}
            restoreAllRecipes={restoreAllRecipes}
            permanentDeleteFromBin={permanentDeleteFromBin}
            deleteAllRecipes={deleteAllRecipes}
            isLoading={isLoading}
            allTags={allTags}
            bulkImportRecipes={bulkImportRecipes}
            onEnterKitchenMode={(recipe) => openKitchenMode(recipe)}
            handleEditRecipe={(r) => { setRecipeToEdit(r); setIsAddRecipeModalOpen(true); }}
            onOpenAddRecipeModal={() => { setRecipeToEdit(undefined); setIsAddRecipeModalOpen(true); }}
            onDetectSimilar={onDetectSimilar}
            similarityGroups={similarityGroups}
            setSimilarityGroups={setSimilarityGroups}
            onSetDefaultDrink={(id) => {
                setRecipes(prev => prev.map(r => r.category === RecipeCategory.Drink ? { ...r, isDefaultDrink: r.id === id } : r));
            }}
          />
        )}
        
        {activeTab.id === 'log' && <LogView eatenLog={eatenLog} mealPlan={mealPlan} />}
        
        {activeTab.id === 'settings' && (
            <SettingsView 
                settings={settings} 
                onSettingsChange={setSettings} 
                allTags={allTags}
                onAllTagsChange={setAllTags}
                recipes={recipes}
                onBulkUpdateRecipes={setRecipes}
                onResetApp={() => {
                    localStorage.clear();
                    setAnimationKey(k => k + 1);
                    window.location.reload();
                }}
            />
        )}
      </main>

      {kitchenModeContext && (
        <KitchenModeView 
          recipe={kitchenModeContext.recipe} 
          portions={kitchenModeContext.portions} 
          totalPlanPortions={kitchenModeContext.totalPlanPortions}
          settings={settings}
          onClose={() => setKitchenModeContext(null)} 
        />
      )}

      {editMealDetails && (
          <EditMealModal 
            onClose={() => setEditMealDetails(null)}
            onSave={onSaveMealEdit}
            recipes={recipes}
            mealPlan={mealPlan}
            date={editMealDetails.date}
            forcedType={editMealDetails.type}
          />
      )}

      {isAddRecipeModalOpen && (
          <AddRecipeModal 
            onClose={() => setIsAddRecipeModalOpen(false)}
            onAddRecipe={async (data) => { await addRecipe(data); setIsAddRecipeModalOpen(false); }}
            onUpdateRecipe={async (recipe) => { await updateRecipe(recipe); setIsAddRecipeModalOpen(false); }}
            isLoading={isLoading}
            recipeToEdit={recipeToEdit}
            settings={settings}
            allTags={allTags}
          />
      )}

      {notification && (
        <div className="fixed bottom-6 right-6 z-[200] animate-fade-in">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${notification.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
             <div className="bg-white/20 p-2 rounded-lg">
                {notification.type === 'success' ? <CheckIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>}
             </div>
             <p className="font-bold text-sm tracking-tight">{notification.message}</p>
             {notification.undoAction && (
                 <button onClick={() => { notification.undoAction?.(); setNotification(null); }} className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 ml-2">Undo</button>
             )}
             <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70"><XIcon className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
