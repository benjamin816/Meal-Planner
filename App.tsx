
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tab, MealPlan, EatenLog, Settings, Recipe, RecipeCategory, RecipeTag, PlannedMeal, GeneratedRecipeData, MealType, BulkParsedRecipe, NutritionGoals, ShoppingListCategory, ShoppingListItem, UsageIntensity, SimilarityGroup } from './types';
import { TABS, DEFAULT_SETTINGS, DEFAULT_ALL_TAGS, INITIAL_RECIPES } from './constants';
import { analyzeRecipeWithGemini, generateMealPlanWithGemini, bulkParseRecipesFromFileWithGemini, bulkGenerateAndAnalyzeRecipesWithGemini, editRecipeWithGemini, generateShoppingListWithGemini, findSimilarRecipesWithGemini } from './services/geminiService';
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
  const [kitchenModeContext, setKitchenModeContext] = useState<{ recipe: Recipe, portions?: number[] } | null>(null);
  const [editMealDetails, setEditMealDetails] = useState<{ date: string, type: MealType } | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | undefined>(undefined);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'delete', undoAction?: () => void } | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('mealPlannerSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings) as Settings);
      const savedTags = localStorage.getItem('mealPlannerTags');
      if (savedTags) setAllTags(JSON.parse(savedTags) as Record<RecipeCategory, RecipeTag[]>);
      const savedRecipes = localStorage.getItem('mealPlannerRecipes');
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes) as Recipe[]); else setRecipes(INITIAL_RECIPES);
      const savedBin = localStorage.getItem('mealPlannerBin');
      if (savedBin) setBinRecipes(JSON.parse(savedBin) as Recipe[]);
      const savedMealPlan = localStorage.getItem('mealPlannerPlan');
      if (savedMealPlan) setMealPlan(new Map(JSON.parse(savedMealPlan) as [string, PlannedMeal][]));
      const savedEatenLog = localStorage.getItem('mealPlannerEatenLog');
      if (savedEatenLog) setEatenLog(new Map(JSON.parse(savedEatenLog) as [string, Partial<Record<MealType, boolean>>][]));
      const savedShoppingList = localStorage.getItem('mealPlannerShoppingList');
      if (savedShoppingList) setShoppingList(JSON.parse(savedShoppingList) as ShoppingListCategory[]);
    } catch (e) { console.error(e); }
    setIsDataLoaded(true);
  }, []);

  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerSettings', JSON.stringify(settings)); }, [settings, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerRecipes', JSON.stringify(recipes)); }, [recipes, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerBin', JSON.stringify(binRecipes)); }, [binRecipes, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerPlan', JSON.stringify(Array.from(mealPlan.entries()))); }, [mealPlan, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem('mealPlannerShoppingList', JSON.stringify(shoppingList)); }, [shoppingList, isDataLoaded]);

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
    const scaledPromises = frequencyEntries.map(async ({ r, totalPortions }) => {
        const prompt = `Scale ingredients to exactly ${totalPortions.toFixed(2)} servings. Return just the ingredients text.`;
        try {
            const res = await editRecipeWithGemini(r, prompt, settings.blacklistedIngredients);
            return res.ingredients;
        } catch { return r.ingredients + ` (x${totalPortions})`; }
    });
    const allScaledText = (await Promise.all(scaledPromises)).join('\n');
    const categorized = await generateShoppingListWithGemini(allScaledText);
    const final: ShoppingListCategory[] = categorized.map((cat, idx) => ({
        id: `cat_${idx}_${Date.now()}`,
        name: cat.category,
        items: cat.items.map((item, iIdx) => ({ id: `item_${idx}_${iIdx}_${Date.now()}`, name: item, checked: false }))
    }));
    setShoppingList(final);
    setGenerationStatus("");
  }, [settings.blacklistedIngredients]);

  const clearPlan = useCallback(() => {
    if (window.confirm("Are you sure you want to clear the entire meal plan and shopping list? This cannot be undone.")) {
        setMealPlan(new Map());
        setShoppingList([]);
        showNotification("Meal plan and shopping list cleared.", 'delete');
    }
  }, [showNotification]);

  const generatePlan = async (startDate: string, durationWeeks: number, dinnersPerWeek: number, breakfastsPerWeek: number, snacksPerWeek: number, drinkId?: string, drinkQty: number = 2) => {
    setIsLoading(true);
    setGenerationProgress(12);
    setGenerationStatus("Consulting AI Chef...");
    
    const progressTimer = setInterval(() => {
        setGenerationProgress(prev => {
            if (prev < 90) return prev + 0.8;
            return prev;
        });
        setGenerationStatus(prev => {
            if (generationProgress > 15 && generationProgress < 40) return "Optimizing caloric distribution...";
            if (generationProgress >= 40 && generationProgress < 70) return "Drafting variety-rich meal schedule...";
            if (generationProgress >= 70 && generationProgress < 85) return "Validating portions for each person...";
            if (generationProgress >= 85) return "Ensuring dinner is the largest meal...";
            return prev;
        });
    }, 400);

    try {
      const tempSettings = { ...settings, planDurationWeeks: durationWeeks, dinnersPerWeek, breakfastsPerWeek, snacksPerWeek };
      const selectedDrink = recipes.find(r => r.id === drinkId);
      const newPlan = await generateMealPlanWithGemini(tempSettings, recipes, startDate, selectedDrink, drinkQty);
      
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

  const addRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
    setIsLoading(true);
    try {
        const analysis = await analyzeRecipeWithGemini(recipeData, settings);
        const newRecipe: Recipe = { id: `r_${Date.now()}`, ...recipeData, ...analysis, tags: [], servings: 1 };
        setRecipes(prev => [...prev, newRecipe]);
        setIsAddRecipeModalOpen(false);
        showNotification(`Added ${newRecipe.name}`, 'success');
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [settings, showNotification]);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    showNotification("Recipe updated!", "success");
  }, [showNotification]);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes(currentRecipes => {
      const r = currentRecipes.find(rec => rec.id === id);
      if (!r) return currentRecipes;
      
      const deletedRecipe = { ...r, deletedAt: new Date().toISOString() };
      setBinRecipes(prev => [...prev, deletedRecipe]);
      
      showNotification(`${r.name} moved to trash.`, 'delete', () => {
          setRecipes(prev => [...prev, r]);
          setBinRecipes(prev => prev.filter(rec => rec.id !== id));
          setNotification(null);
      });
      
      return currentRecipes.filter(rec => rec.id !== id);
    });
  }, [showNotification]);

  const handleTabChange = useCallback((tab: Tab) => { setActiveTab(tab); setAnimationKey(p => p + 1); }, []);

  const renderContent = () => {
    switch (activeTab.id) {
      case 'planner': return (
        <PlannerView 
            mealPlan={mealPlan} eatenLog={eatenLog} recipes={recipes} settings={settings} generatePlan={generatePlan} isLoading={isLoading} generationProgress={generationProgress} generationStatus={generationStatus}
            onMarkAsEaten={(d, t, e) => {
                setEatenLog(prev => {
                    const next = new Map(prev);
                    const day: Partial<Record<MealType, boolean>> = { ...((next.get(d) || {}) as object) };
                    day[t] = e;
                    next.set(d, day);
                    return next;
                });
            }}
            onRemovePlannedMeal={(d, t) => {
                setMealPlan(prev => {
                    const next = new Map(prev);
                    const dayRaw = next.get(d);
                    if (!dayRaw) return prev;
                    const day: PlannedMeal = { ...(dayRaw as object) };
                    delete day[t];
                    next.set(d, day);
                    updateShoppingListFromPlan(next);
                    return next;
                });
            }}
            onSwapPlannedMeal={() => {}} 
            onAddPlannedMeal={(date, type) => setEditMealDetails({date, type})}
            onClearPlan={clearPlan}
            setActiveTab={handleTabChange} 
            onViewRecipe={(recipe, portions) => setKitchenModeContext({ recipe, portions })}
            hasShoppingItems={shoppingList.length > 0} 
            generationPrerequisites={{ canGenerate: true, missingMessage: "" }} 
            defaultUniqueSettings={{ dinners: settings.dinnersPerWeek, breakfasts: settings.breakfastsPerWeek, snacks: settings.snacksPerWeek }} 
            showPlanSuccess={false}
            setShowPlanSuccess={() => {}}
        />
      );
      case 'shopping': return <ShoppingListView shoppingList={shoppingList} setShoppingList={setShoppingList} settings={settings} />;
      case 'meals': return <MealsView recipes={recipes} binRecipes={binRecipes} settings={settings} addRecipe={addRecipe} updateRecipe={updateRecipe} deleteRecipe={deleteRecipe} restoreRecipe={(id) => {
          const r = binRecipes.find(rec => rec.id === id);
          if (!r) return;
          setRecipes(prev => [...prev, r]);
          setBinRecipes(prev => prev.filter(rec => rec.id !== id));
      }} restoreAllRecipes={() => {
          setRecipes(prev => [...prev, ...binRecipes]);
          setBinRecipes([]);
      }} permanentDeleteFromBin={(id) => {
          setBinRecipes(prev => prev.filter(rec => rec.id !== id));
      }} deleteAllRecipes={() => setRecipes([])} isLoading={isLoading} allTags={allTags} bulkImportRecipes={async()=>{}} onEnterKitchenMode={r => setKitchenModeContext({ recipe: r })} handleEditRecipe={r => { setRecipeToEdit(r); setIsAddRecipeModalOpen(true); }} onOpenAddRecipeModal={() => { setRecipeToEdit(undefined); setIsAddRecipeModalOpen(true); }} onDetectSimilar={()=>{}} />;
      case 'log': return <LogView eatenLog={eatenLog} mealPlan={mealPlan} />;
      case 'settings': return <SettingsView settings={settings} onSettingsChange={setSettings} allTags={allTags} onAllTagsChange={setAllTags} recipes={recipes} onBulkUpdateRecipes={setRecipes} onResetApp={()=>{}} />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
        <div className="container mx-auto p-4 md:p-6 flex-grow">
            <Header activeTab={activeTab} setActiveTab={handleTabChange} />
            <main className="mt-6 bg-white p-6 rounded-lg shadow-sm relative">
                <div key={animationKey} className="fade-in">{renderContent()}</div>
                {notification && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4">
                        <div className={`bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between border-b-4 shadow-2xl ${notification.type === 'delete' ? 'border-red-500' : 'border-green-500'}`}>
                            <div className="flex flex-col">
                                <p className="text-sm font-bold truncate">{notification.message}</p>
                                {notification.undoAction && (
                                    <button onClick={notification.undoAction} className="text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 text-left mt-0.5">Undo Action</button>
                                )}
                            </div>
                            <button onClick={() => setNotification(null)} className="ml-2 text-gray-400 hover:text-white"><XIcon className="w-4 h-4"/></button>
                        </div>
                    </div>
                )}
            </main>
        </div>
        {kitchenModeContext && <KitchenModeView recipe={kitchenModeContext.recipe} portions={kitchenModeContext.portions} settings={settings} onClose={() => setKitchenModeContext(null)} />}
        {editMealDetails && (
            <EditMealModal 
                onClose={() => setEditMealDetails(null)} 
                onSave={(type, rec, mode) => { 
                    if (mode === 'replace_single' || mode === 'replace_all') {
                        setMealPlan(prev => {
                            const next = new Map(prev);
                            const dayRaw = next.get(editMealDetails.date);
                            if (!dayRaw) return prev;
                            const day: PlannedMeal = { ...(dayRaw as object) };
                            day[type] = rec;
                            next.set(editMealDetails.date, day);
                            updateShoppingListFromPlan(next);
                            return next;
                        });
                    }
                    setEditMealDetails(null); 
                }} 
                recipes={recipes} mealPlan={mealPlan} date={editMealDetails.date} forcedType={editMealDetails.type}
            />
        )}
        {isAddRecipeModalOpen && <AddRecipeModal onClose={() => setIsAddRecipeModalOpen(false)} onAddRecipe={addRecipe} onUpdateRecipe={updateRecipe} isLoading={isLoading} allTags={allTags} recipeToEdit={recipeToEdit} settings={settings} />}
    </div>
  );
};

export default App;
