

import React, { useState, useEffect, useRef } from 'react';
import { Recipe, RecipeCategory, RecipeTag, GeneratedRecipeData, Settings, BulkParsedRecipe } from '../types';
import { LoadingIcon, XIcon, ImportIcon, MagicWandIcon } from './Icons';
import { editRecipeWithGemini } from '../services/geminiService';

interface AddRecipeModalProps {
  onClose: () => void;
  onAddRecipe: (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => void;
  onUpdateRecipe?: (recipe: Recipe) => void;
  isLoading: boolean;
  allTags: Record<RecipeCategory, RecipeTag[]>;
  recipeToEdit?: Recipe;
  prefilledData?: GeneratedRecipeData | null;
  settings: Settings;
}

const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ 
    onClose, onAddRecipe, onUpdateRecipe, isLoading, allTags, 
    recipeToEdit, prefilledData, settings
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>(RecipeCategory.Dinner);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isAlsoBreakfast, setIsAlsoBreakfast] = useState(false);
  const [rating, setRating] = useState(5);
  const [servings, setServings] = useState(recipeToEdit?.servings || 4);
  const [macros, setMacros] = useState(recipeToEdit?.macros || {calories: 0, protein: 0, carbs: 0, fat: 0});
  const [healthScore, setHealthScore] = useState(recipeToEdit?.healthScore || 0);
  const [scoreReasoning, setScoreReasoning] = useState(recipeToEdit?.scoreReasoning || '');
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const isEditMode = !!recipeToEdit;
  const isPrefillMode = !!prefilledData;

  const servingDebounceTimeout = useRef<number | null>(null);

  // --- Populating Form Data ---
  useEffect(() => {
    const data = recipeToEdit || prefilledData;
    if (data) {
        setName(data.name);
        setCategory(data.category);
        setTags(data.tags);
        setIngredients(data.ingredients);
        setInstructions(data.instructions);
        setServings(data.servings || 4);
        if ('macros' in data) { // Check if it's a full Recipe or BulkParsedRecipe
            setMacros(data.macros);
            setHealthScore(data.healthScore);
            setScoreReasoning(data.scoreReasoning);
        }
        if ('rating' in data) { // Is a Recipe
             setRating(data.rating || 5);
             setIsAlsoBreakfast(data.isAlsoBreakfast || false);
        }
    }
  }, [recipeToEdit, prefilledData]);
  
  // --- Auto-adjust servings on change ---
  useEffect(() => {
      if (!isEditMode) return; // Only run in edit mode

      if (servingDebounceTimeout.current) {
          clearTimeout(servingDebounceTimeout.current);
      }
      
      servingDebounceTimeout.current = window.setTimeout(() => {
          if (servings > 0 && recipeToEdit && servings !== recipeToEdit.servings) {
              const prompt = `Adjust this recipe from ${recipeToEdit.servings} servings to ${servings} servings. Update ingredient quantities and instructions accordingly, but keep everything else the same.`;
              handleAiGenerate(prompt, true); // isServingsAdjustment = true
          }
      }, 1500); // 1.5 second debounce

      return () => {
          if (servingDebounceTimeout.current) {
              clearTimeout(servingDebounceTimeout.current);
          }
      }
  }, [servings, recipeToEdit, isEditMode]);

  // --- Handlers ---
  const handleTagClick = (tag: RecipeTag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value as RecipeCategory;
    setCategory(newCategory);
    setTags([]); // Reset tags when category changes
  };

  const updateFormWithAiData = (aiData: BulkParsedRecipe) => {
      setName(aiData.name);
      setIngredients(aiData.ingredients);
      setInstructions(aiData.instructions);
      setCategory(aiData.category);
      setTags(aiData.tags);
      setServings(aiData.servings);
      setMacros(aiData.macros);
      setHealthScore(aiData.healthScore);
      setScoreReasoning(aiData.scoreReasoning);
  };
  
  const handleAiGenerate = async (promptOverride?: string, isServingsAdjustment = false) => {
      const currentPrompt = promptOverride || aiPrompt;
      if (!currentPrompt) {
          alert("Please enter your desired changes in the AI Assistant prompt box.");
          return;
      }
      
      setIsGenerating(true);
      try {
          const recipeForAi: Recipe = isEditMode ? {
              ...recipeToEdit, name, category, tags, ingredients, instructions, isAlsoBreakfast, rating, servings, macros, healthScore, scoreReasoning
          } : { // Create a temporary recipe object for AI to edit
              id: 'temp', name, category, tags, ingredients, instructions, isAlsoBreakfast, rating, servings, macros, healthScore, scoreReasoning
          };
          
          const result = await editRecipeWithGemini(recipeForAi, currentPrompt, settings.blacklistedIngredients);
          updateFormWithAiData(result);
          if (!isServingsAdjustment) {
              setAiPrompt('');
          }
      } catch (error) {
          console.error("AI edit failed:", error);
          alert("Failed to get a response from the AI. Please try again.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleHealthify = () => {
    const healthifyPrompt = `Make this recipe healthier to better match my nutrition goals: ${JSON.stringify(settings.people[0].goals)}. Focus on reducing calories, sugars, and unhealthy fats while keeping protein high. Suggest specific ingredient substitutions or quantity changes.`;
    setAiPrompt(healthifyPrompt);
    handleAiGenerate(healthifyPrompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ingredients || !instructions) {
      alert("Please fill in all fields.");
      return;
    }
    if (isEditMode && onUpdateRecipe) {
        onUpdateRecipe({
            ...recipeToEdit,
            name, category, tags, ingredients, instructions, isAlsoBreakfast, rating, servings, macros, healthScore, scoreReasoning
        });
    } else {
        onAddRecipe({ name, category, tags, ingredients, instructions, isAlsoBreakfast, rating, servings });
    }
  };
  
  const availableTags = allTags[category] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Recipe' : (isPrefillMode ? 'Review AI-Generated Recipe' : 'Add New Recipe')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select id="category" value={category} onChange={handleCategoryChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  {Object.values(RecipeCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
                    <div className="relative">
                        <input type="number" id="servings" value={servings} onChange={e => setServings(parseInt(e.target.value) || 0)} min="1" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
                        {isGenerating && isEditMode && <div className="absolute right-2 top-1/2 -translate-y-1/2"><LoadingIcon/></div>}
                    </div>
                </div>
                <div>
                    <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">Your Rating (1-10)</label>
                    <input type="number" id="rating" value={rating} onChange={e => setRating(parseInt(e.target.value))} min="1" max="10" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
                </div>
             </div>
             {category === RecipeCategory.Snack && (
                <div className="flex items-center">
                    <input type="checkbox" id="isAlsoBreakfast" checked={isAlsoBreakfast} onChange={e => setIsAlsoBreakfast(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="isAlsoBreakfast" className="ml-2 block text-sm text-gray-900">Mark as a breakfast option</label>
                </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                   <button type="button" key={tag} onClick={() => handleTagClick(tag)} className={`py-1 px-3 rounded-full text-sm transition-colors ${tags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-lg text-purple-800 mb-2">AI Assistant</h3>
                 <div>
                    <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                       {isEditMode ? 'How would you like to change this recipe?' : 'Describe the recipe you want to create.'}
                    </label>
                    <textarea
                        id="ai-prompt"
                        rows={2}
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        placeholder={isEditMode ? "e.g., 'Make it vegetarian', 'double the recipe', 'add garlic'" : "e.g., 'A simple vegetarian lasagna for 4 people', 'High-protein chicken and broccoli stir-fry'"}
                    />
                     <div className="mt-2 flex items-center gap-x-4">
                        <button
                            type="button"
                            onClick={() => handleAiGenerate()}
                            disabled={isGenerating || isLoading}
                            className="px-4 py-2 bg-purple-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
                        >
                            {isGenerating ? <LoadingIcon /> : <MagicWandIcon />}
                            <span className="ml-2">{isGenerating ? 'Generating...' : (isEditMode ? 'Generate Changes' : 'Generate Recipe')}</span>
                        </button>
                         {isEditMode && healthScore < 8 && (
                            <button
                                type="button"
                                onClick={handleHealthify}
                                disabled={isGenerating || isLoading}
                                className="text-sm text-green-600 hover:text-green-800 font-semibold inline-flex items-center"
                            >
                                <MagicWandIcon className="h-4 w-4 mr-1"/>
                                Suggestion: Make it Healthier
                            </button>
                        )}
                     </div>
                </div>
            </div>

            <div>
              <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
              <textarea id="ingredients" value={ingredients} onChange={e => setIngredients(e.target.value)} rows={5} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="List each ingredient on a new line." required></textarea>
            </div>
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
              <textarea id="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} rows={7} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Step-by-step cooking instructions." required></textarea>
            </div>
          </div>
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
            <button type="submit" disabled={isLoading || isGenerating} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center">
              {(isLoading || isGenerating) && <LoadingIcon />}
              {(isLoading || isGenerating) ? 'Processing...' : isEditMode ? 'Update Recipe' : 'Add Recipe & Analyze'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRecipeModal;