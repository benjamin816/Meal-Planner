import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory, RecipeTag, GeneratedRecipeData } from '../types';
import { LoadingIcon, XIcon, ImportIcon, MagicWandIcon } from './Icons';

interface AddRecipeModalProps {
  onClose: () => void;
  onAddRecipe: (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => void;
  onUpdateRecipe?: (recipe: Recipe) => void;
  isLoading: boolean;
  allTags: Record<RecipeCategory, RecipeTag[]>;
  recipeToEdit?: Recipe;
  prefilledData?: GeneratedRecipeData | null;
  onSwitchToImport: () => void;
  onSwitchToGenerate: () => void;
}

const AddRecipeModal: React.FC<AddRecipeModalProps> = ({ 
    onClose, onAddRecipe, onUpdateRecipe, isLoading, allTags, 
    recipeToEdit, prefilledData, onSwitchToImport, onSwitchToGenerate 
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>(RecipeCategory.Dinner);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isAlsoBreakfast, setIsAlsoBreakfast] = useState(false);
  const [rating, setRating] = useState(5);

  const isEditMode = !!recipeToEdit;
  const isPrefillMode = !!prefilledData;

  useEffect(() => {
    if (isEditMode) {
      setName(recipeToEdit.name);
      setCategory(recipeToEdit.category);
      setTags(recipeToEdit.tags);
      setIngredients(recipeToEdit.ingredients);
      setInstructions(recipeToEdit.instructions);
      setIsAlsoBreakfast(recipeToEdit.isAlsoBreakfast || false);
      setRating(recipeToEdit.rating || 5);
    } else if (isPrefillMode) {
        setName(prefilledData.name);
        setIngredients(prefilledData.ingredients);
        setInstructions(prefilledData.instructions);
        setCategory(prefilledData.category);
        setTags(prefilledData.tags);
    }
  }, [recipeToEdit, isEditMode, prefilledData, isPrefillMode]);


  const handleTagClick = (tag: RecipeTag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value as RecipeCategory;
    setCategory(newCategory);
    setTags([]); // Reset tags when category changes
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
            name, category, tags, ingredients, instructions, isAlsoBreakfast, rating,
        });
    } else {
        onAddRecipe({ name, category, tags, ingredients, instructions, isAlsoBreakfast, rating });
    }
  };
  
  const availableTags = allTags[category] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Recipe' : (isPrefillMode ? 'Review AI-Generated Recipe' : 'Add New Recipe')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon />
          </button>
        </div>

        {!isEditMode && !isPrefillMode && (
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-center items-center gap-x-6">
                <button
                type="button"
                onClick={onSwitchToImport}
                className="text-blue-600 hover:text-blue-800 font-semibold text-sm inline-flex items-center"
                >
                <ImportIcon />
                <span className="ml-2">Import from URL</span>
                </button>
                 <button
                type="button"
                onClick={onSwitchToGenerate}
                className="text-purple-600 hover:text-purple-800 font-semibold text-sm inline-flex items-center"
                >
                <MagicWandIcon />
                <span className="ml-2">Create with AI</span>
                </button>
            </div>
        )}

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
             <div className="flex items-center justify-between">
                {category === RecipeCategory.Snack && (
                <div className="flex items-center">
                    <input type="checkbox" id="isAlsoBreakfast" checked={isAlsoBreakfast} onChange={e => setIsAlsoBreakfast(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="isAlsoBreakfast" className="ml-2 block text-sm text-gray-900">Mark as a breakfast option</label>
                </div>
                )}
                <div className="w-full md:w-auto md:ml-auto">
                    <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">Your Rating (1-10)</label>
                    <input type="number" id="rating" value={rating} onChange={e => setRating(parseInt(e.target.value))} min="1" max="10" className="w-full md:w-32 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
                </div>
             </div>
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
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center">
              {isLoading && <LoadingIcon />}
              {isLoading ? 'Analyzing...' : isEditMode ? 'Update Recipe' : 'Add Recipe & Analyze'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRecipeModal;
