import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Person, NutritionGoals, RecipeCategory, DayOfWeek, DaySettings, RecipeTag, Recipe } from '../types';
import { SettingsIcon, MagicWandIcon, XIcon, CheckIcon, LoadingIcon, HeartIcon, TrashIcon } from './Icons';
import AutoSuggestGoalsModal from './AutoSuggestGoalsModal';
import { reconcileRecipesWithBlacklist, ReconciliationResult } from '../services/geminiService';

interface SettingsViewProps {
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    allTags: Record<RecipeCategory, RecipeTag[]>;
    onAllTagsChange: (newAllTags: Record<RecipeCategory, RecipeTag[]>) => void;
    recipes: Recipe[];
    onBulkUpdateRecipes: (updatedRecipes: Recipe[]) => void;
    onResetApp: () => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsChange, allTags, onAllTagsChange, recipes, onBulkUpdateRecipes, onResetApp }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const [isAutoSuggestModalOpen, setIsAutoSuggestModalOpen] = useState(false);
    const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(null);
    const [newBlacklistedIngredient, setNewBlacklistedIngredient] = useState('');
    const [newMinimalIngredient, setNewMinimalIngredient] = useState('');
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconciliationReport, setReconciliationReport] = useState<ReconciliationResult[] | null>(null);
    
    // Reset Confirmation Step (0-3)
    const [resetStep, setResetStep] = useState(0);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        const finalPeople: Person[] = [];
        for (let i = 0; i < localSettings.numberOfPeople; i++) {
            finalPeople.push(localSettings.people[i] || { name: `Person ${i + 1}`, goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } });
        }
        onSettingsChange({ ...localSettings, people: finalPeople });
        alert('Settings saved!');
    };

    const handlePersonChange = (index: number, field: keyof Person, value: string) => {
        setLocalSettings(prev => {
            const newPeople = [...prev.people];
            newPeople[index] = { ...newPeople[index], [field]: value };
            return { ...prev, people: newPeople };
        });
    };

    const handleGoalsChange = (personIndex: number, field: keyof NutritionGoals, value: number) => {
        setLocalSettings(prev => {
            const newPeople = [...prev.people];
            const person = newPeople[personIndex];
            person.goals = { ...person.goals, [field]: value };
            return { ...prev, people: newPeople };
        });
    };
    
    const handleSuggestedGoals = (goals: NutritionGoals) => {
        if (editingPersonIndex !== null) {
            handleGoalsChange(editingPersonIndex, 'calories', goals.calories);
            handleGoalsChange(editingPersonIndex, 'protein', goals.protein);
            handleGoalsChange(editingPersonIndex, 'carbs', goals.carbs);
            handleGoalsChange(editingPersonIndex, 'fat', goals.fat);
        }
        setIsAutoSuggestModalOpen(false);
        setEditingPersonIndex(null);
    };

    const handleAddBlacklistedIngredient = async () => {
        const ingredientToAdd = newBlacklistedIngredient.trim().toLowerCase();
        if (ingredientToAdd && !localSettings.blacklistedIngredients.includes(ingredientToAdd)) {
            setIsReconciling(true);
            try {
                const results = await reconcileRecipesWithBlacklist(recipes, ingredientToAdd);
                
                if (results.length > 0) {
                    setReconciliationReport(results);
                    const updatedRecipeList = recipes.map(r => {
                        const reconciliation = results.find(res => res.originalId === r.id);
                        if (reconciliation) {
                            return {
                                ...r,
                                ...reconciliation.updatedRecipe,
                                id: r.id
                            } as Recipe;
                        }
                        return r;
                    });
                    onBulkUpdateRecipes(updatedRecipeList);
                } else {
                    alert(`Ingredient "${ingredientToAdd}" added. No recipes currently in your library use this ingredient.`);
                }

                setLocalSettings(prev => ({
                    ...prev,
                    blacklistedIngredients: [...prev.blacklistedIngredients, ingredientToAdd].sort()
                }));
                setNewBlacklistedIngredient('');
            } catch (error) {
                console.error("Reconciliation failed:", error);
                alert("Failed to reconcile recipes with the new blacklist. Ingredient added but recipes were not updated.");
                 setLocalSettings(prev => ({
                    ...prev,
                    blacklistedIngredients: [...prev.blacklistedIngredients, ingredientToAdd].sort()
                }));
            } finally {
                setIsReconciling(false);
            }
        }
    };

    const handleRemoveBlacklistedIngredient = (ingredientToRemove: string) => {
        setLocalSettings(prev => ({
            ...prev,
            blacklistedIngredients: prev.blacklistedIngredients.filter(i => i !== ingredientToRemove)
        }));
    };

    const handleAddMinimalIngredient = () => {
        const ingredientToAdd = newMinimalIngredient.trim().toLowerCase();
        if (ingredientToAdd && !localSettings.minimalIngredients.includes(ingredientToAdd)) {
            setLocalSettings(prev => ({
                ...prev,
                minimalIngredients: [...prev.minimalIngredients, ingredientToAdd].sort()
            }));
            setNewMinimalIngredient('');
        }
    };

    const handleRemoveMinimalIngredient = (ingredientToRemove: string) => {
        setLocalSettings(prev => ({
            ...prev,
            minimalIngredients: prev.minimalIngredients.filter(i => i !== ingredientToRemove)
        }));
    };

    const toggleDailyMeal = (day: DayOfWeek, meal: keyof DaySettings) => {
        setLocalSettings(prev => ({
            ...prev,
            dailyMeals: {
                ...prev.dailyMeals,
                [day]: {
                    ...prev.dailyMeals[day],
                    [meal]: !prev.dailyMeals[day][meal]
                }
            }
        }));
    };

    const minAllowedMaxUses = useMemo(() => {
        const totalSlotsPerWeek = 7;
        const uniqueDinners = localSettings.dinnersPerWeek;
        const minDinnersPerRecipe = Math.ceil(totalSlotsPerWeek / uniqueDinners);
        return minDinnersPerRecipe * (localSettings.useLeftoverForLunch ? 2 : 1);
    }, [localSettings.dinnersPerWeek, localSettings.useLeftoverForLunch]);

    useEffect(() => {
        if (localSettings.maxUsesPerRecipePerPlan < minAllowedMaxUses) {
            setLocalSettings(prev => ({ ...prev, maxUsesPerRecipePerPlan: minAllowedMaxUses }));
        }
    }, [minAllowedMaxUses]);

    const handleResetAppWithConfirmation = () => {
        if (resetStep < 3) {
            setResetStep(prev => prev + 1);
        } else {
            onResetApp();
            setResetStep(0);
        }
    };

    const getResetButtonText = () => {
        switch (resetStep) {
            case 0: return "RESET APP TO DEFAULT";
            case 1: return "ARE YOU SURE? (1/3)";
            case 2: return "ARE YOU POSITIVE? (2/3)";
            case 3: return "FINAL WARNING: WIPE ALL DATA (3/3)";
            default: return "RESET APP TO DEFAULT";
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center mb-6">
                <SettingsIcon className="text-blue-600 w-8 h-8" />
                <h2 className="text-2xl font-bold text-gray-700 ml-3">Settings</h2>
            </div>

            <div className="space-y-8">
                {/* Plan Generation Settings */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                        Plan Generation
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Default planned duration (Weeks)</label>
                            <select value={localSettings.planDurationWeeks} onChange={e => setLocalSettings({...localSettings, planDurationWeeks: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500">
                                {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w} Week{w > 1 ? 's' : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Number of People</label>
                            <select value={localSettings.numberOfPeople} onChange={e => setLocalSettings({...localSettings, numberOfPeople: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500">
                                {[1, 2, 3, 4, 5, 6].map(p => <option key={p} value={p}>{p} Person{p > 1 ? 's' : ''}</option>)}
                            </select>
                        </div>
                    </div>

                     <div className="mt-8 p-6 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <h4 className="text-lg font-bold text-blue-800 mb-4 flex items-center">Meal Logic</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unique dinner recipes per week</label>
                                    <input 
                                        type="number" 
                                        min="1" max="7" 
                                        value={localSettings.dinnersPerWeek} 
                                        onChange={e => setLocalSettings({...localSettings, dinnersPerWeek: parseInt(e.target.value) || 1})}
                                        className="w-full border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unique breakfast recipes per week</label>
                                    <input 
                                        type="number" 
                                        min="1" max="7" 
                                        value={localSettings.breakfastsPerWeek} 
                                        onChange={e => setLocalSettings({...localSettings, breakfastsPerWeek: parseInt(e.target.value) || 1})}
                                        className="w-full border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unique snack recipes per week</label>
                                    <input 
                                        type="number" 
                                        min="1" max="7" 
                                        value={localSettings.snacksPerWeek} 
                                        onChange={e => setLocalSettings({...localSettings, snacksPerWeek: parseInt(e.target.value) || 1})}
                                        className="w-full border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-normal text-gray-700 mb-1">Default Drinks per Person (Daily)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            min="0" max="10" 
                                            value={localSettings.defaultDrinksPerPersonPerDay} 
                                            onChange={e => setLocalSettings({...localSettings, defaultDrinksPerPersonPerDay: parseInt(e.target.value) || 0})}
                                            className="w-full border-gray-300 rounded-lg"
                                        />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Units</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                    <label className="block text-sm font-normal text-gray-700 mb-1">Max uses per recipe (7 day period/person)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            min={minAllowedMaxUses}
                                            value={localSettings.maxUsesPerRecipePerPlan} 
                                            onChange={e => setLocalSettings({...localSettings, maxUsesPerRecipePerPlan: Math.max(minAllowedMaxUses, parseInt(e.target.value) || minAllowedMaxUses)})}
                                            className="w-full border-gray-300 rounded-lg font-bold"
                                        />
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tight leading-none min-w-[100px]">
                                            Min required: <span className="text-blue-600">{minAllowedMaxUses}</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 italic">Limits total appearances for ANY recipe per person per 7 days.</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-6 rounded-lg flex flex-col justify-center space-y-4">
                                <label className="flex items-center p-3 bg-white rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={localSettings.useLeftoverForLunch} 
                                        onChange={e => setLocalSettings({...localSettings, useLeftoverForLunch: e.target.checked})} 
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-semibold text-gray-800">Use Dinners to create Lunches</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-tight">Efficiency Booster</p>
                                    </div>
                                </label>
                                
                                <label className="flex items-center p-3 bg-white rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={localSettings.autoAdjustPortions} 
                                        onChange={e => setLocalSettings({...localSettings, autoAdjustPortions: e.target.checked})} 
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-semibold text-gray-800">Auto-Adjust Serving Portions</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-tight">Matches individual calorie goals</p>
                                    </div>
                                </label>

                                <div className="flex flex-col space-y-2 p-3 bg-white rounded-xl border border-blue-200">
                                    <label className="flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={localSettings.fudgeRoom > 0} 
                                            onChange={e => {
                                                setLocalSettings({
                                                    ...localSettings, 
                                                    fudgeRoom: e.target.checked ? (localSettings.fudgeRoom || 250) : 0
                                                });
                                            }} 
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="ml-3">
                                            <p className="text-sm font-semibold text-gray-800">Fudge room for dessert/treats</p>
                                        </div>
                                    </label>
                                    {localSettings.fudgeRoom > 0 && (
                                        <div className="ml-7 flex items-center gap-2 animate-fade-in">
                                            <input 
                                                type="number"
                                                value={localSettings.fudgeRoom}
                                                onChange={e => setLocalSettings({...localSettings, fudgeRoom: Math.max(0, parseInt(e.target.value) || 0)})}
                                                className="w-24 border-gray-300 rounded-lg text-sm font-bold focus:ring-blue-500 focus:border-blue-500"
                                                min="0"
                                            />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">calories</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Daily Meals Configuration */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                        Meals To Plan (Daily)
                    </h3>
                    <p className="text-sm text-gray-600 mb-6 italic">Toggle which meals the planner should schedule for your group daily.</p>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-center">
                            <thead>
                                <tr className="text-gray-500 uppercase text-[10px] font-bold tracking-widest">
                                    <th className="text-left pb-4">Day</th>
                                    <th className="pb-4">Breakfast</th>
                                    <th className="pb-4">Lunch</th>
                                    <th className="pb-4">Dinner</th>
                                    <th className="pb-4">Snack</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {DAYS.map((day) => (
                                    <tr key={day} className="group hover:bg-white transition-colors">
                                        <td className="text-left py-4 font-bold text-gray-700">{day}</td>
                                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(meal => (
                                            <td key={meal} className="py-4">
                                                <button
                                                    onClick={() => toggleDailyMeal(day, meal)}
                                                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center mx-auto transition-all ${
                                                        localSettings.dailyMeals[day][meal]
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                                                        : 'bg-white border-gray-200 text-transparent hover:border-gray-300'
                                                    }`}
                                                >
                                                    <CheckIcon className="w-6 h-6" />
                                                </button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Avoided Ingredients & Sensitivities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Banned Ingredients */}
                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                            <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">3</span>
                            Avoided (Banned)
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-widest">Strict removal from all meals</p>
                        <div className="flex items-center mb-4">
                            <input 
                                type="text" 
                                placeholder="e.g., mushrooms" 
                                value={newBlacklistedIngredient}
                                onChange={(e) => setNewBlacklistedIngredient(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddBlacklistedIngredient();
                                    }
                                }}
                                disabled={isReconciling}
                                className="flex-grow border-gray-300 rounded-l-xl shadow-sm focus:ring-blue-500 disabled:bg-gray-100"
                            />
                            <button 
                                type="button" 
                                onClick={handleAddBlacklistedIngredient} 
                                disabled={isReconciling || !newBlacklistedIngredient.trim()}
                                className="bg-red-600 text-white px-4 py-2 rounded-r-xl hover:bg-red-700 font-bold disabled:bg-red-300"
                            >
                                {isReconciling ? <LoadingIcon className="w-4 h-4" /> : 'Add'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border min-h-[56px]">
                            {localSettings.blacklistedIngredients.map(ing => (
                                <span key={ing} className="bg-red-50 text-red-700 text-[10px] font-black pl-3 pr-1 py-1 rounded-full flex items-center border border-red-100 uppercase tracking-tighter">
                                    {ing}
                                    <button onClick={() => handleRemoveBlacklistedIngredient(ing)} className="ml-1 text-red-300 hover:text-red-500 transition-colors">
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Minimal Ingredients (Sensitivities) */}
                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                            <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">4</span>
                            Sensitivities (Minimal)
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-widest">Reduce frequency/quantity</p>
                        <div className="flex items-center mb-4">
                            <input 
                                type="text" 
                                placeholder="e.g., dairy, garlic" 
                                value={newMinimalIngredient}
                                onChange={(e) => setNewMinimalIngredient(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddMinimalIngredient();
                                    }
                                }}
                                className="flex-grow border-gray-300 rounded-l-xl shadow-sm focus:ring-blue-500"
                            />
                            <button 
                                type="button" 
                                onClick={handleAddMinimalIngredient} 
                                disabled={!newMinimalIngredient.trim()}
                                className="bg-orange-500 text-white px-4 py-2 rounded-r-xl hover:bg-orange-600 font-bold disabled:bg-orange-300"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border min-h-[56px]">
                            {localSettings.minimalIngredients.map(ing => (
                                <span key={ing} className="bg-orange-50 text-orange-700 text-[10px] font-black pl-3 pr-1 py-1 rounded-full flex items-center border border-orange-100 uppercase tracking-tighter">
                                    {ing}
                                    <button onClick={() => handleRemoveMinimalIngredient(ing)} className="ml-1 text-orange-300 hover:text-orange-500 transition-colors">
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* People & Nutrition Goals */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                         <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">5</span>
                        People & Nutrition Goals
                    </h3>
                    <div className="space-y-6">
                        {Array.from({ length: localSettings.numberOfPeople }).map((_, index) => {
                            const person = localSettings.people[index] || { name: `Person ${index + 1}`, goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } };
                            return (
                                <div key={index} className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                        <input 
                                            type="text" 
                                            value={person.name} 
                                            onChange={e => handlePersonChange(index, 'name', e.target.value)} 
                                            className="font-bold text-xl border-b-2 border-transparent focus:border-blue-500 focus:outline-none bg-transparent" 
                                        />
                                        <button onClick={() => { setEditingPersonIndex(index); setIsAutoSuggestModalOpen(true); }} className="text-sm text-purple-600 hover:bg-purple-50 px-4 py-2 rounded-lg font-bold flex items-center border border-purple-200 transition-colors">
                                            <MagicWandIcon className="w-4 h-4 mr-2" />
                                            Auto-Suggest
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Calories</label>
                                            <input type="number" value={person.goals.calories} onChange={e => handleGoalsChange(index, 'calories', parseInt(e.target.value))} className="w-full border-gray-200 rounded-lg font-bold text-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Protein %</label>
                                            <input type="number" value={person.goals.protein} onChange={e => handleGoalsChange(index, 'protein', parseInt(e.target.value))} className="w-full border-gray-200 rounded-lg font-bold text-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Carbs %</label>
                                            <input type="number" value={person.goals.carbs} onChange={e => handleGoalsChange(index, 'carbs', parseInt(e.target.value))} className="w-full border-gray-200 rounded-lg font-bold text-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Fat %</label>
                                            <input type="number" value={person.goals.fat} onChange={e => handleGoalsChange(index, 'fat', parseInt(e.target.value))} className="w-full border-gray-200 rounded-lg font-bold text-gray-700" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-200 gap-6">
                    {/* Danger Zone: Reset Application */}
                    <div className="w-full md:w-auto p-6 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center text-center gap-3">
                        <div className="flex items-center gap-2 text-red-700">
                            <TrashIcon className="w-5 h-5" />
                            <h4 className="font-black text-sm uppercase tracking-widest leading-none">Danger Zone</h4>
                        </div>
                        <p className="text-[10px] font-bold text-red-600 max-w-[240px]">This will permanently wipe all your saved recipes, plans, logs, and settings.</p>
                        <button 
                            onClick={handleResetAppWithConfirmation}
                            onMouseLeave={() => setResetStep(0)}
                            className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 border-2 ${
                                resetStep === 0 ? 'bg-white border-red-200 text-red-600 hover:bg-red-600 hover:text-white' :
                                resetStep === 1 ? 'bg-orange-400 border-orange-500 text-white animate-pulse' :
                                resetStep === 2 ? 'bg-orange-600 border-orange-700 text-white animate-pulse shadow-orange-200' :
                                'bg-red-600 border-red-700 text-white animate-bounce'
                            }`}
                        >
                            {getResetButtonText()}
                        </button>
                    </div>

                    <button onClick={handleSave} className="w-full md:w-auto px-12 py-5 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 hover:shadow-2xl transition-all font-black text-lg transform active:scale-95">
                        SAVE ALL SETTINGS
                    </button>
                </div>
            </div>

            {isAutoSuggestModalOpen && (
                <AutoSuggestGoalsModal 
                    onClose={() => setIsAutoSuggestModalOpen(false)}
                    onGoalsSuggested={handleSuggestedGoals}
                />
            )}

            {reconciliationReport && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[130] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-gray-100 bg-blue-50/50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">AI Reconciliation Report</h2>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em] mt-1">Automatic substitution & Macro adjustment</p>
                            </div>
                            <button onClick={() => setReconciliationReport(null)} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all"><XIcon className="w-6 h-6 text-gray-400"/></button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-grow space-y-6">
                            <p className="text-sm text-gray-600 font-medium bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                Your recipe library has been automatically updated to remove the blacklisted ingredient. Here is a summary of the changes made by the AI:
                            </p>
                            {reconciliationReport.map((item, idx) => {
                                const original = recipes.find(r => r.id === item.originalId);
                                return (
                                    <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-black text-lg text-gray-800">{original?.name}</h4>
                                            <span className="text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-1 rounded-md">Updated</span>
                                        </div>
                                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Changes Made</p>
                                            <p className="text-sm text-gray-700 font-medium">{item.changesSummary}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Macro Update</p>
                                                <div className="flex gap-2 text-[10px] font-bold text-gray-600">
                                                    <span>{original?.macros?.calories || 0} → {item.updatedRecipe?.macros?.calories || 0} kcal</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Health Score</p>
                                                <div className="flex gap-2 text-[10px] font-bold text-gray-600">
                                                    <span>{original?.healthScore || 0} → {item.updatedRecipe?.healthScore || 0} / 10</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-center">
                            <button 
                                onClick={() => setReconciliationReport(null)}
                                className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black shadow-lg active:scale-95 transition-all"
                            >
                                Acknowledge & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;