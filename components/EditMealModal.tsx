
import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, PlannedMeal, MealType, RecipeCategory, UsageIntensity, MealPlan } from '../types';
import { XIcon, MagicWandIcon, CalendarIcon, ShoppingCartIcon, CheckIcon } from './Icons';

interface EditMealModalProps {
  onClose: () => void;
  onSave: (mealType: MealType, newRecipe: Recipe, mode: 'swap_days' | 'replace_all' | 'replace_single', swapDate?: string) => void;
  recipes: Recipe[];
  mealPlan: MealPlan;
  date: string;
  forcedType?: MealType;
}

const EditMealModal: React.FC<EditMealModalProps> = ({ onClose, onSave, recipes, mealPlan, date, forcedType }) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>(forcedType || 'breakfast');
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'swap_days' | 'replace_all' | 'replace_single'>('swap_days');

  useEffect(() => { if (forcedType) setSelectedMealType(forcedType); }, [forcedType]);

  const currentRecipe = mealPlan.get(date)?.[selectedMealType];

  const filteredRecipes = useMemo(() => {
    if (mode === 'swap_days') return []; 
    
    return recipes.filter(r => {
        const isLunchOrDinner = selectedMealType === 'lunch' || selectedMealType === 'dinner';
        const categoryMatch = isLunchOrDinner 
            ? r.category === RecipeCategory.Dinner 
            : (r.category === (selectedMealType === 'breakfast' ? RecipeCategory.Breakfast : RecipeCategory.Snack) || (selectedMealType === 'breakfast' && r.isAlsoBreakfast) || (selectedMealType === 'snack' && r.isAlsoSnack));
        return categoryMatch && r.name.toLowerCase().includes(searchTerm.toLowerCase());
    }).slice(0, 50);
  }, [recipes, searchTerm, mode, selectedMealType]);

  const plannedSwaps = useMemo(() => {
      const swaps: { date: string, recipe: Recipe }[] = [];
      mealPlan.forEach((day, dStr) => {
          if (dStr === date || day.isMealPrepDay) return;
          const r = day[selectedMealType as keyof PlannedMeal] as Recipe;
          if (r && r.name.toLowerCase().includes(searchTerm.toLowerCase())) {
              swaps.push({ date: dStr, recipe: r });
          }
      });
      return swaps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mealPlan, date, selectedMealType, searchTerm]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-16 z-[70] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-black text-gray-800">Modify Meal</h2>
            <p className="text-xs font-bold text-gray-400 uppercase mt-1">FOR {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
        </div>

        <div className="p-1 bg-gray-100 flex text-[10px] font-black uppercase tracking-widest shrink-0">
            <button onClick={() => setMode('swap_days')} className={`flex-1 py-3 rounded-xl transition-all ${mode === 'swap_days' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Swap Days</button>
            <button onClick={() => setMode('replace_single')} className={`flex-1 py-3 rounded-xl transition-all ${mode === 'replace_single' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>New (Single)</button>
            <button onClick={() => setMode('replace_all')} className={`flex-1 py-3 rounded-xl transition-all ${mode === 'replace_all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Replace All</button>
        </div>

        <div className="p-6 border-b bg-white space-y-4">
            <div className="flex gap-3">
                <input
                    type="text"
                    placeholder={`Search ${mode === 'swap_days' ? 'scheduled days' : 'recipe library'}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-blue-500 font-medium"
                />
            </div>
            {currentRecipe && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                    <div className="flex-grow">
                        <span className="text-[9px] font-black text-blue-400 uppercase">Currently Scheduled</span>
                        <p className="text-sm font-bold text-blue-800">{currentRecipe.name}</p>
                    </div>
                </div>
            )}
        </div>

        <div className="flex-grow overflow-y-auto p-4">
            {mode === 'swap_days' ? (
                <div className="space-y-2">
                    {plannedSwaps.map(swap => (
                        <div key={swap.date} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center group">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase mb-1">{new Date(swap.date).toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'})}</p>
                                <p className="font-bold text-gray-800 line-clamp-1">{swap.recipe.name}</p>
                            </div>
                            <button 
                                onClick={() => onSave(selectedMealType, swap.recipe, 'swap_days', swap.date)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95"
                            >
                                Swap
                            </button>
                        </div>
                    ))}
                    {plannedSwaps.length === 0 && <p className="text-center text-gray-400 py-10 font-bold uppercase text-xs">No other matching {selectedMealType}s found.</p>}
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="p-4 hover:bg-gray-50 rounded-2xl flex justify-between items-center group transition-colors">
                            <div className="flex-grow">
                                <p className="font-bold text-gray-800 group-hover:text-blue-600">{recipe.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{(recipe.macros?.calories || 0).toFixed(0)} kcal per serving</p>
                            </div>
                            <button 
                                onClick={() => onSave(selectedMealType, recipe, mode as 'replace_all' | 'replace_single')}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-md transition-all active:scale-90 ${mode === 'replace_all' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}
                            >
                                {mode === 'replace_all' ? 'Replace All' : 'Select'}
                            </button>
                        </div>
                    ))}
                    {filteredRecipes.length === 0 && searchTerm && <p className="text-center text-gray-400 py-10 font-bold uppercase text-xs">No library matches found.</p>}
                </div>
            )}
        </div>
        {mode === 'replace_all' && (
            <div className="p-4 bg-purple-50 border-t border-purple-100 flex items-center gap-3">
                <MagicWandIcon className="w-5 h-5 text-purple-600" />
                <p className="text-[10px] font-black text-purple-800 uppercase leading-tight">This will replace ALL occurrences of "{currentRecipe?.name || 'the current recipe'}" throughout the plan.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default EditMealModal;
