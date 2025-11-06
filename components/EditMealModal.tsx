
import React, { useState, useMemo } from 'react';
import { Recipe, PlannedMeal, MealType, RecipeCategory } from '../types';
import { XIcon } from './Icons';

interface EditMealModalProps {
  onClose: () => void;
  onSave: (mealType: MealType, newRecipe: Recipe) => void;
  recipes: Recipe[];
  dayPlan: PlannedMeal;
  date: string;
}

const EditMealModal: React.FC<EditMealModalProps> = ({ onClose, onSave, recipes, dayPlan, date }) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [searchTerm, setSearchTerm] = useState('');

  const mealTypesWithRecipes = useMemo((): MealType[] => {
    return (Object.keys(dayPlan) as MealType[]).filter(mt => dayPlan[mt]);
  }, [dayPlan]);
  
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
        const categoryMatch = r.category === recipeCategoryForMealType || (recipeCategoryForMealType === RecipeCategory.Breakfast && r.isAlsoBreakfast);
        const searchMatch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
        const notCurrent = r.id !== currentRecipe?.id;
        return categoryMatch && searchMatch && notCurrent;
    }).slice(0, 100); // Limit results for performance
  }, [recipes, searchTerm, recipeCategoryForMealType, currentRecipe]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-16 z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Swap Meal</h2>
            <p className="text-sm text-gray-500">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
        </div>
        
        <div className="p-4 border-b">
            <div className="flex items-center gap-x-4">
                <select 
                    value={selectedMealType} 
                    onChange={e => setSelectedMealType(e.target.value as MealType)}
                    className="border-gray-300 rounded-md shadow-sm"
                >
                    {mealTypesWithRecipes.map(mt => (
                        <option key={mt} value={mt} className="capitalize">{mt}</option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder={`Search for a new ${selectedMealType}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm"
                />
            </div>
            {currentRecipe && <p className="text-xs text-gray-500 mt-2">Currently: <strong>{currentRecipe.name}</strong></p>}
        </div>

        <div className="flex-grow overflow-y-auto">
            <ul className="divide-y divide-gray-200">
                {filteredRecipes.map(recipe => (
                    <li key={recipe.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-800">{recipe.name}</p>
                            <p className="text-xs text-gray-500">{recipe.macros.calories.toFixed(0)} kcal</p>
                        </div>
                        <button 
                            onClick={() => onSave(selectedMealType, recipe)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                        >
                            Select
                        </button>
                    </li>
                ))}
            </ul>
            {filteredRecipes.length === 0 && (
                <div className="text-center p-8 text-gray-500">No other matching recipes found.</div>
            )}
        </div>
      </div>
    </div>
  );
};

export default EditMealModal;
