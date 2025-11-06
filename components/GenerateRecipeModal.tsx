import React, { useState } from 'react';
import { XIcon, LoadingIcon, MagicWandIcon } from './Icons';
import { generateRecipeFromIdeaWithGemini } from '../services/geminiService';
import { GeneratedRecipeData, RecipeCategory, RecipeTag } from '../types';

interface GenerateRecipeModalProps {
    onClose: () => void;
    onRecipeGenerated: (data: GeneratedRecipeData) => void;
    allTags: Record<RecipeCategory, RecipeTag[]>;
}

const GenerateRecipeModal: React.FC<GenerateRecipeModalProps> = ({ onClose, onRecipeGenerated, allTags }) => {
    const [idea, setIdea] = useState('');
    const [category, setCategory] = useState<RecipeCategory>(RecipeCategory.Dinner);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idea) {
            setError('Please enter a recipe idea.');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const availableTags = allTags[category] || [];
            const recipeData = await generateRecipeFromIdeaWithGemini(idea, category, availableTags);
            onRecipeGenerated({ ...recipeData, category });
        } catch (err: any) {
            console.error(err);
            setError('The AI could not generate a recipe from this idea. Please try being more specific or try a different idea.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Create Recipe with AI</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon />
                    </button>
                </div>
                <form onSubmit={handleGenerate}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="idea" className="block text-sm font-medium text-gray-700 mb-1">What kind of recipe are you thinking of?</label>
                            <input 
                                type="text" 
                                id="idea" 
                                value={idea} 
                                onChange={e => setIdea(e.target.value)} 
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" 
                                placeholder="e.g., healthy chicken and rice bowl"
                                required 
                            />
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Assign to Category</label>
                            <select id="category" value={category} onChange={e => setCategory(e.target.value as RecipeCategory)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {Object.values(RecipeCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        {error && (
                            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                                <p className="font-bold">Generation Failed</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}
                        <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                            <p>Our AI chef will create a brand new recipe based on your idea, complete with a name, ingredients, instructions, and suggested tags for you to review.</p>
                        </div>
                    </div>
                    <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 flex items-center">
                            {isLoading ? <LoadingIcon /> : <MagicWandIcon />}
                            <span className="ml-2">{isLoading ? 'Generating...' : 'Generate & Review'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GenerateRecipeModal;
