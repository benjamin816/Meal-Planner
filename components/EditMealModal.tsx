import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, PlannedMeal, MealType, RecipeCategory, UsageIntensity } from '../types';
import { XIcon, MagicWandIcon, PlusIcon } from './Icons';

interface EditMealModalProps {
  onClose: () => void;
  onSave: (mealType: MealType, newRecipe: Recipe) => void;
  recipes: Recipe[];
  dayPlan: PlannedMeal;
  date: string;
  forcedType?: MealType;
}

const IntensityIndicatorSmall = ({ intensity }: { intensity: UsageIntensity }) => {
    const bars = {
        light: { count: 1, color: 'bg-green-400' },
        normal: { count: 2, color: 'bg-blue-400' },
        heavy: { count: 3, color: 'bg-purple-500' }
    }[intensity];

    return (
        <div className="flex items-end gap-0.5 h-3" title={`${intensity} usage`}>
            {[1, 2, 3].map(i => (
                <div 
                    key={i} 
                    className={`w-1 rounded-sm ${i <= bars.count ? bars.color : 'bg-gray-200'} ${i === 1 ? 'h-1.5' : i === 2 ? 'h-2.2' : 'h-3'}`}
                />
            ))}
        </div>
    );
};

const EditMealModal: React.FC<EditMealModalProps> = ({ onClose, onSave, recipes, dayPlan, date, forcedType }) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>(forcedType || 'breakfast');
  const [searchTerm, setSearchTerm] = useState('');

  const mealTypesWithRecipes = useMemo((): MealType[] => {
    return (Object.keys(dayPlan) as MealType[]).filter(mt => dayPlan[mt]);
  }, [dayPlan]);
  
  useEffect(() => {
    if (forcedType) setSelectedMealType(forcedType);
  }, [forcedType]);

  const currentRecipe = dayPlan[selectedMealType];
  const recipeCategoryForMealType = useMemo((): RecipeCategory => {
    switch (selectedMealType) {
        case 'breakfast': return RecipeCategory.Breakfast;
        case 'snack': return RecipeCategory.Snack;
        case 'lunch':
        case 'dinner':
        default:
            return RecipeCategory.Dinner;
    }
  }, [selectedMealType]);
  
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
        const isLunchOrDinner = selectedMealType === 'lunch' || selectedMealType === 'dinner';
        const categoryMatch = isLunchOrDinner 
            ? r.category === RecipeCategory.Dinner 
            : (r.category === recipeCategoryForMealType || (recipeCategoryForMealType === RecipeCategory.Breakfast && r.isAlsoBreakfast) || (recipeCategoryForMealType === RecipeCategory.Snack && r.isAlsoSnack));
            
        const searchMatch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
        const notCurrent = r.id !== currentRecipe?.id;
        return categoryMatch && searchMatch && notCurrent;
    }).sort((a,b) => {
        // Sort by intensity preference for swaps
        const order = { heavy: 3, normal: 2, light: 1 };
        return order[b.usageIntensity] - order[a.usageIntensity];
    }).slice(0, 100);
  }, [recipes, searchTerm, recipeCategoryForMealType, currentRecipe, selectedMealType]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-start pt-16 z-[70] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">{currentRecipe ? 'Swap Meal' : 'Add Meal'}</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"><XIcon /></button>
        </div>
        
        <div className="p-6 border-b bg-white">
            <div className="flex items-center gap-3">
                {!forcedType && (
                    <select 
                        value={selectedMealType} 
                        onChange={e => setSelectedMealType(e.target.value as MealType)}
                        className="bg-gray-100 border-none rounded-xl text-sm font-bold text-gray-700 py-3 px-4 focus:ring-blue-500"
                    >
                        {['breakfast', 'lunch', 'snack', 'dinner'].map(mt => (
                            <option key={mt} value={mt} className="capitalize">{mt}</option>
                        ))}
                    </select>
                )}
                <div className="relative flex-grow">
                    <input
                        type="text"
                        placeholder={`Find a ${selectedMealType}...`}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                </div>
            </div>
            {currentRecipe && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-black text-blue-400 uppercase">CURRENT</span>
                    <p className="text-sm font-bold text-blue-800">{currentRecipe.name}</p>
                </div>
            )}
        </div>

        <div className="flex-grow overflow-y-auto p-2 bg-white">
            <ul className="space-y-1">
                {filteredRecipes.map(recipe => (
                    <li key={recipe.id} className="p-4 hover:bg-gray-50 rounded-2xl flex justify-between items-center group transition-colors">
                        <div>
                            <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{recipe.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{(recipe.macros?.calories || 0).toFixed(0)} kcal</span>
                                <IntensityIndicatorSmall intensity={recipe.usageIntensity} />
                            </div>
                        </div>
                        <button 
                            onClick={() => onSave(selectedMealType, recipe)}
                            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md transform active:scale-90 transition-all"
                        >
                            Select
                        </button>
                    </li>
                ))}
            </ul>
            {filteredRecipes.length === 0 && (
                <div className="text-center py-12 px-6">
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No matching recipes found</p>
                    <p className="text-gray-300 text-xs mt-2">Try adding more recipes to your library first.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default EditMealModal;