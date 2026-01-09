
import React, { useState, useEffect, useRef } from 'react';
import { Recipe, RecipeCategory, GeneratedRecipeData, Settings, BulkParsedRecipe, RecipeTag, UsageIntensity } from '../types';
import { LoadingIcon, XIcon, MagicWandIcon } from './Icons';
import { editRecipeWithGemini } from '../services/geminiService';

interface AddRecipeModalProps {
  onClose: () => void;
  onAddRecipe: (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => void;
  onUpdateRecipe?: (recipe: Recipe) => void;
  isLoading: boolean;
  recipeToEdit?: Recipe;
  prefilledData?: GeneratedRecipeData | null;
  settings: Settings;
  allTags: Record<RecipeCategory, RecipeTag[]>;
}

const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ 
    onClose, onAddRecipe, onUpdateRecipe, isLoading, 
    recipeToEdit, prefilledData, settings, allTags
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RecipeCategory>(RecipeCategory.Dinner);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isAlsoBreakfast, setIsAlsoBreakfast] = useState(false);
  const [isAlsoSnack, setIsAlsoSnack] = useState(false);
  const [usageIntensity, setUsageIntensity] = useState<UsageIntensity>('normal');
  const [macros, setMacros] = useState(recipeToEdit?.macros || {calories: 0, protein: 0, carbs: 0, fat: 0});
  const [healthScore, setHealthScore] = useState(recipeToEdit?.healthScore || 0);
  const [scoreReasoning, setScoreReasoning] = useState(recipeToEdit?.scoreReasoning || '');
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const isEditMode = !!recipeToEdit;
  const isPrefillMode = !!prefilledData;

  useEffect(() => {
    if (recipeToEdit) {
        setName(recipeToEdit.name);
        setDescription(recipeToEdit.description || '');
        setCategory(recipeToEdit.category);
        setIngredients(recipeToEdit.ingredients);
        setInstructions(recipeToEdit.instructions);
        setMacros(recipeToEdit.macros);
        setHealthScore(recipeToEdit.healthScore);
        setScoreReasoning(recipeToEdit.scoreReasoning);
        setUsageIntensity(recipeToEdit.usageIntensity || 'normal');
        setIsAlsoBreakfast(recipeToEdit.isAlsoBreakfast || false);
        setIsAlsoSnack(recipeToEdit.isAlsoSnack || false);
    } else if (prefilledData) {
        setName(prefilledData.name);
        setDescription(prefilledData.description || '');
        setCategory(prefilledData.category);
        setIngredients(prefilledData.ingredients);
        setInstructions(prefilledData.instructions);
        
        const anyData = prefilledData as any;
        if (anyData.macros) {
            setMacros(anyData.macros);
            setHealthScore(anyData.healthScore || 0);
            setScoreReasoning(anyData.scoreReasoning || '');
        }
        if (anyData.usageIntensity) {
            setUsageIntensity(anyData.usageIntensity);
        }
        setIsAlsoBreakfast(anyData.isAlsoBreakfast || false);
        setIsAlsoSnack(anyData.isAlsoSnack || false);
    }
  }, [recipeToEdit, prefilledData]);

  useEffect(() => {
    if (category === RecipeCategory.Dinner) {
      setIsAlsoBreakfast(false);
      setIsAlsoSnack(false);
    }
  }, [category]);

  const handleAiGenerate = async (promptOverride?: string) => {
      const currentPrompt = promptOverride || aiPrompt;
      if (!currentPrompt) { alert("Please enter your desired changes in the AI Assistant prompt box."); return; }
      setIsGenerating(true);
      try {
          const recipeForAi = (isEditMode ? {
              ...recipeToEdit, name, description, category, ingredients, instructions, isAlsoBreakfast, isAlsoSnack, usageIntensity, servings: 1, macros, healthScore, scoreReasoning
          } : { 
              id: 'temp', name, description, category, ingredients, instructions, isAlsoBreakfast, isAlsoSnack, usageIntensity, servings: 1, macros, healthScore, scoreReasoning
          }) as Recipe;
          const result = await editRecipeWithGemini(recipeForAi, currentPrompt, settings.blacklistedIngredients);
          setName(result.name);
          setDescription(result.description || '');
          setIngredients(result.ingredients);
          setInstructions(result.instructions);
          setCategory(result.category);
          setMacros(result.macros);
          setHealthScore(result.healthScore);
          setScoreReasoning(result.scoreReasoning);
          setUsageIntensity(result.usageIntensity || 'normal');
          setAiPrompt('');
      } catch (error) {
          console.error("AI edit failed:", error);
          alert("Failed to get a response from the AI. Please try again.");
      } finally { setIsGenerating(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ingredients || !instructions) { alert("Please fill in all fields."); return; }
    const data = { 
        name, 
        description, 
        category, 
        ingredients, 
        instructions, 
        isAlsoBreakfast, 
        isAlsoSnack, 
        usageIntensity, 
        servings: 1, 
        tags: (recipeToEdit as any)?.tags || [] 
    };
    if (isEditMode && onUpdateRecipe) {
        onUpdateRecipe({ ...recipeToEdit!, ...data, macros, healthScore, scoreReasoning });
    } else {
        onAddRecipe(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Recipe' : (isPrefillMode ? 'Review AI-Generated Recipe' : 'Add New Recipe')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
                <select id="category" value={category} onChange={e => setCategory(e.target.value as RecipeCategory)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  {Object.values(RecipeCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Brief Description</label>
              <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="A short summary of this dish."></textarea>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                    <span className="text-xs font-bold text-gray-500 uppercase">Base Servings</span>
                    <span className="bg-white px-3 py-1 rounded-lg border font-black text-blue-600 shadow-sm text-sm">1 Serving</span>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Usage Intensity</label>
                    <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
                        {(['light', 'normal', 'heavy'] as UsageIntensity[]).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setUsageIntensity(mode)}
                                className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    usageIntensity === mode 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
             </div>

             {category !== RecipeCategory.Dinner && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in shadow-inner">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Meal Planner Availability</p>
                    <div className="flex flex-wrap gap-6">
                        {category !== RecipeCategory.Breakfast && (
                            <label className="flex items-center cursor-pointer group">
                                <input type="checkbox" checked={isAlsoBreakfast} onChange={e => setIsAlsoBreakfast(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <span className="ml-2 text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Could be a <strong>Breakfast</strong></span>
                            </label>
                        )}
                        {category !== RecipeCategory.Snack && (
                            <label className="flex items-center cursor-pointer group">
                                <input type="checkbox" checked={isAlsoSnack} onChange={e => setIsAlsoSnack(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <span className="ml-2 text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Could be a <strong>Snack</strong></span>
                            </label>
                        )}
                    </div>
                </div>
             )}

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl shadow-inner">
                <div className="flex items-center mb-3">
                    <MagicWandIcon className="text-purple-600 w-5 h-5 mr-2" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-purple-800">AI Recipe Assistant</h3>
                </div>
                <div>
                    <textarea id="ai-prompt" rows={2} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm" placeholder="e.g., 'Make it higher protein' or 'Ensure it's gluten free'"></textarea>
                     <div className="mt-2 flex justify-end">
                        <button type="button" onClick={() => handleAiGenerate()} disabled={isGenerating || isLoading} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-purple-700 disabled:bg-purple-300 flex items-center shadow-md transition-all active:scale-95">
                            {isGenerating ? <LoadingIcon className="w-4 h-4 mr-2" /> : <MagicWandIcon className="w-4 h-4 mr-2" />}
                            {isGenerating ? 'Generating...' : (isEditMode ? 'Apply AI Edit' : 'Auto-Complete Recipe')}
                        </button>
                     </div>
                </div>
            </div>

            <div>
              <label htmlFor="ingredients" className="block text-sm font-bold text-gray-700 mb-1">Ingredients (1 Serving Base)</label>
              <textarea id="ingredients" value={ingredients} onChange={e => setIngredients(e.target.value)} rows={5} className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-medium" placeholder="List each ingredient on a new line." required></textarea>
            </div>
            <div>
              <label htmlFor="instructions" className="block text-sm font-bold text-gray-700 mb-1">Instructions</label>
              <textarea id="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} rows={7} className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-medium" placeholder="Step-by-step cooking instructions." required></textarea>
            </div>
          </div>
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black uppercase tracking-widest text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isLoading || isGenerating} className="px-8 py-2 bg-blue-600 border border-transparent rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center shadow-lg transition-all active:scale-95">
              {(isLoading || isGenerating) && <LoadingIcon className="w-4 h-4 mr-2" />}
              {(isLoading || isGenerating) ? 'Working...' : isEditMode ? 'Save Changes' : 'Analyze & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRecipeModal;
