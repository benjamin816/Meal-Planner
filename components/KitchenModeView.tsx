
import React, { useState } from 'react';
import { Recipe } from '../types';
import { XIcon, CheckIcon } from './Icons';

interface KitchenModeViewProps {
  recipe: Recipe;
  onClose: () => void;
}

const KitchenModeView: React.FC<KitchenModeViewProps> = ({ recipe, onClose }) => {
  const ingredientsList = recipe.ingredients.split('\n').filter(line => line.trim() !== '');
  const instructionsList = recipe.instructions.split('\n').filter(line => line.trim() !== '');

  const [checkedIngredients, setCheckedIngredients] = useState<boolean[]>(Array(ingredientsList.length).fill(false));
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(Array(instructionsList.length).fill(false));

  const toggleIngredient = (index: number) => {
    setCheckedIngredients(prev => {
      const newChecked = [...prev];
      newChecked[index] = !newChecked[index];
      return newChecked;
    });
  };

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = !newSteps[index];
      return newSteps;
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">{recipe.name}</h1>
        <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
          <XIcon className="w-8 h-8" />
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ingredients Column */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Ingredients</h2>
          <ul className="space-y-3">
            {ingredientsList.map((ingredient, index) => (
              <li key={index}>
                <label className="flex items-center cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={checkedIngredients[index]}
                        onChange={() => toggleIngredient(index)}
                        className="hidden"
                    />
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${checkedIngredients[index] ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400 group-hover:border-gray-600'}`}>
                        {checkedIngredients[index] && <CheckIcon className="text-white" />}
                    </div>
                    <span className={`text-lg text-gray-700 transition-colors ${checkedIngredients[index] ? 'line-through text-gray-400' : ''}`}>{ingredient}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions Column */}
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Instructions</h2>
          <ol className="space-y-6">
            {instructionsList.map((instruction, index) => (
              <li key={index} className="flex items-start">
                 <div 
                    onClick={() => toggleStep(index)}
                    className={`cursor-pointer shrink-0 mt-1 mr-4 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${completedSteps[index] ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                    {index + 1}
                </div>
                <p className={`text-lg leading-relaxed text-gray-800 ${completedSteps[index] ? 'opacity-50' : ''}`}>{instruction}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default KitchenModeView;
