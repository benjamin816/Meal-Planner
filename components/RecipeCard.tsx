
import React from 'react';
import { Recipe } from '../types';
import Tag from './Tag';
import { StarIcon } from './Icons';

interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onSelect, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
      <div className="p-4 flex-grow cursor-pointer" onClick={() => onSelect(recipe)}>
        <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{recipe.name}</h3>
            <div className="flex items-center">
                <StarIcon filled className="text-yellow-400" />
                <span className="text-sm font-semibold text-gray-600 ml-1">{recipe.rating}/10</span>
            </div>
        </div>
        <p className="text-xs text-gray-500 mb-3 uppercase font-semibold">{recipe.category}</p>
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
        <button onClick={() => onEdit(recipe)} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
        <button onClick={() => onDelete(recipe.id)} className="text-sm text-red-600 hover:text-red-800 font-semibold">Delete</button>
      </div>
    </div>
  );
};

export default RecipeCard;
