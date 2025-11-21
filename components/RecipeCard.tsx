
import React, { useState, useEffect, useRef } from 'react';
import { Recipe } from '../types';
import Tag from './Tag';
import { StarIcon, MagicWandIcon } from './Icons';

interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onAiEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
}

const HealthScoreCircle = ({ score }: { score: number }) => {
    const percentage = score / 10;
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage);

    let color = 'text-green-500';
    if (score < 4) color = 'text-red-500';
    else if (score < 7) color = 'text-yellow-500';

    return (
        <div className="relative h-10 w-10">
            <svg className="h-full w-full" viewBox="0 0 40 40">
                <circle
                    className="text-gray-200"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="20"
                    cy="20"
                />
                <circle
                    className={color}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="20"
                    cy="20"
                    transform="rotate(-90 20 20)"
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                {score.toFixed(1)}
            </span>
        </div>
    );
};

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onSelect, onAiEdit, onDelete }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const confirmTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (isConfirmingDelete) {
      confirmTimeout.current = window.setTimeout(() => {
        setIsConfirmingDelete(false);
      }, 5000); // Revert after 5 seconds of inactivity
    }

    return () => {
      if (confirmTimeout.current) {
        window.clearTimeout(confirmTimeout.current);
      }
    };
  }, [isConfirmingDelete]);

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleConfirmDelete = () => {
    onDelete(recipe.baseRecipeId || recipe.id);
    // No need to set state back, as the component will be removed from the list.
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow duration-200 fade-in">
      <div className="p-4 flex-grow cursor-pointer" onClick={() => onSelect(recipe)}>
        <div className="flex justify-between items-start mb-2">
            <div>
                <h3 className="text-lg font-bold text-gray-800 pr-2">{recipe.name}</h3>
                {recipe.variationName && <p className="text-xs text-purple-600 font-semibold">{recipe.variationName}</p>}
            </div>
            <div className="flex items-center shrink-0 space-x-3">
                <div title={`Health Score: ${recipe.healthScore.toFixed(1)}/10. ${recipe.scoreReasoning}`}>
                    <HealthScoreCircle score={recipe.healthScore} />
                </div>
                 <div className="flex flex-col items-center">
                    <div className="flex items-center">
                        <StarIcon filled className="text-yellow-400" />
                        <span className="text-sm font-semibold text-gray-600 ml-1">{recipe.rating}/10</span>
                    </div>
                </div>
            </div>
        </div>
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">{recipe.category}</p>
            <p className="text-xs text-gray-500 font-semibold">Serves {recipe.servings}</p>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {recipe.tags.slice(0, 4).map(tag => <Tag key={tag} tag={tag} />)}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
            <div>
                <p className="font-bold text-sm text-gray-800">{recipe.macros.calories.toFixed(0)}</p>
                <p>kcal</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{recipe.macros.protein.toFixed(0)}g</p>
                <p>Protein</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{recipe.macros.carbs.toFixed(0)}g</p>
                <p>Carbs</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{recipe.macros.fat.toFixed(0)}g</p>
                <p>Fat</p>
            </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 border-t flex justify-end space-x-2">
        {isConfirmingDelete ? (
          <>
            <button onClick={handleConfirmDelete} className="text-sm text-red-700 bg-red-100 hover:bg-red-200 font-semibold px-2 py-1 rounded-md transition-colors">Confirm</button>
            <button onClick={handleCancelDelete} className="text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold px-2 py-1 rounded-md transition-colors">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => onAiEdit(recipe)} className="text-sm text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center"><MagicWandIcon className="h-4 w-4 mr-1"/> AI Edit</button>
            <button onClick={handleDeleteClick} className="text-sm text-red-600 hover:text-red-800 font-semibold">Delete</button>
          </>
        )}
      </div>
    </div>
  );
};

export default RecipeCard;
