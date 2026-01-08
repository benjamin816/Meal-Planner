
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  
  const currentImportRef = useRef<{ isCancelled: boolean } | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('mealPlannerSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings) as Settings);
      const savedTags = localStorage.getItem('mealPlannerTags');
      if (savedTags) setAllTags(JSON.parse(savedTags) as Record<RecipeCategory, RecipeTag[]>);
      const savedRecipes = localStorage.getItem('mealPlannerRecipes');
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes) as Recipe[]);
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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setAnimationKey(prev => prev + 1);
  };

  const handleMarkAsEaten = (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', eaten: boolean) => {
    setEatenLog(prev => {
        const newLog = new Map(prev);
        const dayLog = newLog.get(date) || {};
        dayLog[mealType] = eaten;
        if (Object.values(dayLog).every(v => !v)) newLog.delete(date); else newLog.set(date, dayLog);
        return newLog;
    });
  };
  
  const generatePlan = async () => {
    if (recipes.length < 5) { alert("You need at least 5 recipes to generate a meal plan."); return; }
    setIsLoading(true);
    try {
      const newPlan: MealPlan = await generateMealPlanWithGemini(settings, recipes);
      setMealPlan(newPlan);
      const allIngredients = Array.from(newPlan.values()).flatMap(dayPlan => [dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner, dayPlan.snack]).filter((r): r is Recipe => !!r).map(r => r.ingredients).join('\n');
      if (allIngredients.trim()) {
          const categorizedList = await generateShoppingListWithGemini(allIngredients);
          const newShoppingList: ShoppingListCategory[] = categorizedList.map((cat, idx) => ({
              id: `cat_${Date.now()}_${idx}`, name: cat.category, items: cat.items.map((item, itemIdx) => ({ id: `item_${Date.now()}_${idx}_${itemIdx}`, name: item, checked: false }))
          }));
          setShoppingList(newShoppingList);
      }
      alert("Meal plan and shopping list generated successfully!");
    } catch (error) {
      console.error(error); alert("An error occurred during plan generation.");
    } finally { setIsLoading(false); }
  };

  const addRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
    setIsLoading(true);
    try {
        const { isDuplicate, similarRecipeName, reasoning } = await checkForDuplicatesWithGemini(recipeData, recipes);
        if (isDuplicate) { alert(`Duplicate of "${similarRecipeName}".\n\nReason: ${reasoning}`); return; }
        const analysis = await analyzeRecipeWithGemini(recipeData);
        let finalRecipeData: BulkParsedRecipe = { ...recipeData, ...analysis };
        const targetServings = settings.numberOfPeople * settings.servingsPerPerson;
        if (finalRecipeData.servings !== targetServings && targetServings > 0) {
            const prompt = `Scale this recipe to exactly ${targetServings} servings. Update ingredient quantities and instructions.`;
            try { finalRecipeData = await editRecipeWithGemini(finalRecipeData as any as Recipe, prompt, settings.blacklistedIngredients); } catch (e) { console.error(e); }
        }
        const newRecipe: Recipe = { id: `recipe_${Date.now()}_${Math.random()}`, ...finalRecipeData, rating: recipeData.rating, isAlsoBreakfast: recipeData.isAlsoBreakfast };
        setRecipes(prev => [...prev, newRecipe]);
        setIsAddRecipeModalOpen(false);
    } catch (error) {
        console.error(error); alert("Could not analyze and add recipe.");
    } finally { setIsLoading(false); }
  }, [recipes, settings.numberOfPeople, settings.servingsPerPerson, settings.blacklistedIngredients]);

  const updateRecipeAndPlan = useCallback((updatedRecipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    setMealPlan(prev => {
        const newPlan = new Map(prev);
        let updated = false;
        for (const [date, dayPlan] of newPlan.entries()) {
            if (dayPlan && typeof dayPlan === 'object') {
                const newDayPlan: PlannedMeal = { ...dayPlan };
                let dayUpdated = false;
                const types: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
                for (const t of types) { if (newDayPlan[t]?.id === updatedRecipe.id) { newDayPlan[t] = updatedRecipe; dayUpdated = true; } }
                if (dayUpdated) { newPlan.set(date, newDayPlan); updated = true; }
            }
        }
        return updated ? newPlan : prev;
    });
  }, []);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    setIsLoading(true);
    try { updateRecipeAndPlan(updatedRecipe); setIsAddRecipeModalOpen(false); } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [updateRecipeAndPlan]);
  
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
          const targetServings = settings.numberOfPeople * settings.servingsPerPerson;
          const userGoals = settings.people[0].goals;
          let parsedRecipes: BulkParsedRecipe[] = [];

          if (importMode === 'meal_ideas') {
              onProgress('Reading ideas...', 5);
              const text = await sourceFile.text();
              const ideas = text.split(/[\r\n]+/).filter(s => s.trim().length > 3);
              if (ideas.length === 0) throw new Error("No ideas found.");
              if (onAbortSignal.isCancelled) return;
              onProgress(`Found ${ideas.length} ideas. Generating healthy recipes...`, 10);
              parsedRecipes = await bulkGenerateAndAnalyzeRecipesWithGemini(ideas, RecipeCategory.Dinner, allTags.Dinner, settings.blacklistedIngredients, targetServings, userGoals);
          } else {
              onProgress(`Sending to AI for smart parsing...`, 10);
              parsedRecipes = await bulkParseRecipesFromFileWithGemini(sourceFile, allTags.Dinner, settings.blacklistedIngredients, targetServings, userGoals);
          }

          if (onAbortSignal.isCancelled) return;
          if (parsedRecipes.length === 0) throw new Error("No recipes returned.");
          
          onProgress(`Processing ${parsedRecipes.length} recipes...`, 60);

          const uniqueNewRecipes: Recipe[] = [];
          for (let i = 0; i < parsedRecipes.length; i++) {
              if (onAbortSignal.isCancelled) return;
              const data = parsedRecipes[i];
              const percentage = 60 + Math.round((i / parsedRecipes.length) * 40);
              onProgress(`Verifying: ${data.name}`, percentage);
              const { isDuplicate } = await checkForDuplicatesWithGemini(data, [...recipes, ...uniqueNewRecipes]);
              if (!isDuplicate) {
                  uniqueNewRecipes.push({ id: `recipe_${Date.now()}_${uniqueNewRecipes.length}_${Math.random()}`, ...data, rating: 5 });
              }
          }

          if (onAbortSignal.isCancelled) return;
          setRecipes(prev => [...prev, ...uniqueNewRecipes]);
          onComplete(uniqueNewRecipes.length);
      } catch (error: any) {
          if (!onAbortSignal.isCancelled) { console.error(error); throw error; }
      }
  };

  const renderContent = () => {
    switch (activeTab.id) {
      case 'planner': return <PlannerView mealPlan={mealPlan} eatenLog={eatenLog} generatePlan={generatePlan} isLoading={isLoading} onDayClick={(date, plan) => setEditMealDetails({date, plan})} onMarkAsEaten={handleMarkAsEaten} setActiveTab={setActiveTab} onAiEditMeal={r => { setRecipeToEdit(r); setIsAddRecipeModalOpen(true); }} />;
      case 'shopping': return <ShoppingListView shoppingList={shoppingList} setShoppingList={setShoppingList} settings={settings} />;
      case 'meals': return <MealsView recipes={recipes} addRecipe={addRecipe} updateRecipe={updateRecipe} deleteRecipe={deleteRecipe} deleteAllRecipes={deleteAllRecipes} isLoading={isLoading} allTags={allTags} bulkImportRecipes={bulkImportRecipes} onEnterKitchenMode={setKitchenModeRecipe} handleEditRecipe={r => { setRecipeToEdit(r); setIsAddRecipeModalOpen(true); }} onOpenAddRecipeModal={() => { setRecipeToEdit(undefined); setIsAddRecipeModalOpen(true); }} />;
      case 'log': return <LogView eatenLog={eatenLog} mealPlan={mealPlan} />;
      case 'settings': return <SettingsView settings={settings} onSettingsChange={setSettings} allTags={allTags} onAllTagsChange={setAllTags} />;
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
        
        {/* Version Footer */}
        <footer className="container mx-auto px-4 md:px-6 pb-4 flex justify-between items-center text-[10px] text-gray-400 font-mono">
            <div>v5</div>
            <div>{new Date().toLocaleString()}</div>
        </footer>

        {kitchenModeRecipe && <KitchenModeView recipe={kitchenModeRecipe} onClose={() => setKitchenModeRecipe(null)} settings={settings} onAdjustServings={async (r, s) => { setIsLoading(true); try { const prompt = `Scale to ${s} servings.`; return await editRecipeWithGemini(r, prompt, settings.blacklistedIngredients); } catch { return null; } finally { setIsLoading(false); } }} />}
        {editMealDetails && <EditMealModal onClose={() => setEditMealDetails(null)} onSave={(type, rec) => { setMealPlan(prev => { const newPlan = new Map(prev); const day = newPlan.get(editMealDetails.date); if (day) newPlan.set(editMealDetails.date, { ...day, [type]: rec }); return newPlan; }); setEditMealDetails(null); }} recipes={recipes} dayPlan={editMealDetails.plan} date={editMealDetails.date} />}
        {isAddRecipeModalOpen && <AddRecipeModal onClose={() => setIsAddRecipeModalOpen(false)} onAddRecipe={addRecipe} onUpdateRecipe={updateRecipe} isLoading={isLoading} allTags={allTags} recipeToEdit={recipeToEdit} settings={settings} />}
    </div>
  );
};

export default App;
