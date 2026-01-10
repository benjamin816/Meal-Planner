
import React, { useMemo } from 'react';
import { Recipe, UsageIntensity, RecipeCategory, Settings } from '../types';
import { StarIcon, MagicWandIcon, TrashIcon, WarningIcon } from './Icons';

interface RecipeCardProps {
  recipe: Recipe;
  settings: Settings;
  onSelect: (recipe: Recipe) => void;
  onAiEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onSetDefaultDrink?: (id: string) => void;
  showDelete?: boolean;
}

const IntensityIndicator = ({ intensity }: { intensity: UsageIntensity }) => {
    const bars = {
        light: { count: 1, color: 'bg-green-400', label: 'Light Usage' },
        normal: { count: 2, color: 'bg-blue-400', label: 'Normal Usage' },
        heavy: { count: 3, color: 'bg-purple-500', label: 'Heavy Usage' }
    }[intensity];

    return (
        <div className="flex flex-col items-center gap-1" title={bars.label}>
            <div className="flex items-end gap-0.5 h-4">
                {[1, 2, 3].map(i => (
                    <div 
                        key={i} 
                        className={`w-1.5 rounded-sm transition-all duration-300 ${i <= bars.count ? bars.color : 'bg-gray-200'} ${i === 1 ? 'h-2' : i === 2 ? 'h-3' : 'h-4'}`}
                    />
                ))}
            </div>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">{intensity}</span>
        </div>
    );
};

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

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, settings, onSelect, onAiEdit, onDelete, onSetDefaultDrink, showDelete }) => {
  const isDrink = recipe.category === RecipeCategory.Drink;
  const macros = recipe.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const bannedFound = useMemo(() => {
    if (!settings.blacklistedIngredients?.length) return [];
    const text = `${recipe.name} ${recipe.ingredients}`.toLowerCase();
    return settings.blacklistedIngredients.filter(ing => text.includes(ing.toLowerCase()));
  }, [recipe, settings.blacklistedIngredients]);

  return (
    <div className={`bg-white rounded-lg shadow-md border ${bannedFound.length > 0 ? 'border-red-300 ring-1 ring-red-50' : 'border-gray-200'} overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow duration-200 fade-in`}>
      <div className="p-4 flex-grow cursor-pointer" onClick={() => onSelect(recipe)}>
        <div className="flex justify-between items-start mb-2">
            <div className="flex-grow pr-2">
                <h3 className="text-lg font-bold text-gray-800">{recipe.name}</h3>
                {recipe.variationName && <p className="text-xs text-purple-600 font-semibold">{recipe.variationName}</p>}
                {recipe.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{recipe.description}</p>}
                
                {bannedFound.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100 animate-pulse">
                        <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Banned Item Found: {bannedFound[0]}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center shrink-0 space-x-3">
                <div title={`Health Score: ${recipe.healthScore.toFixed(1)}/10. ${recipe.scoreReasoning}`}>
                    <HealthScoreCircle score={recipe.healthScore} />
                </div>
                <IntensityIndicator intensity={recipe.usageIntensity} />
            </div>
        </div>
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">{recipe.category}</p>
            <div className="bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold text-blue-600 uppercase">1 Serving Base</div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
            <div>
                <p className="font-bold text-sm text-gray-800">{(macros.calories || 0).toFixed(0)}</p>
                <p>kcal</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{(macros.protein || 0).toFixed(0)}g</p>
                <p>Protein</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{(macros.carbs || 0).toFixed(0)}g</p>
                <p>Carbs</p>
            </div>
             <div>
                <p className="font-bold text-sm text-gray-800">{(macros.fat || 0).toFixed(0)}g</p>
                <p>Fat</p>
            </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
        <div className="flex items-center">
            {isDrink && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onSetDefaultDrink?.(recipe.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        recipe.isDefaultDrink 
                        ? 'bg-yellow-100 text-yellow-700 shadow-inner' 
                        : 'bg-white text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                    }`}
                >
                    <StarIcon filled={!!recipe.isDefaultDrink} className="w-4 h-4" />
                    {recipe.isDefaultDrink ? 'Default Drink' : 'Set Default'}
                </button>
            )}
        </div>
        <div className="flex space-x-2">
            <button onClick={(e) => { e.stopPropagation(); onAiEdit(recipe); }} className="text-sm text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center"><MagicWandIcon className="h-4 w-4 mr-1"/> AI Edit</button>
            {showDelete && (
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        onDelete(recipe.id); 
                    }} 
                    className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors"
                >
                    <TrashIcon className="h-4 w-4"/>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
