
import React, { useState } from 'react';
import { XIcon, LoadingIcon, ImportIcon } from './Icons';
import { parseRecipeFromTextWithGemini } from '../services/geminiService';
import { GeneratedRecipeData, RecipeCategory, RecipeTag } from '../types';


interface ImportRecipeModalProps {
    onClose: () => void;
    onRecipeImported: (data: GeneratedRecipeData) => void;
    allTags: Record<RecipeCategory, RecipeTag[]>;
}

const ImportRecipeModal: React.FC<ImportRecipeModalProps> = ({ onClose, onRecipeImported, allTags }) => {
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState<RecipeCategory>(RecipeCategory.Dinner);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) {
            setError('Please enter a URL.');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            // We use a CORS proxy to bypass browser security restrictions
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.statusText}`);
            }
            const htmlContent = await response.text();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const cleanText = tempDiv.textContent || tempDiv.innerText || "";
            
            if (!cleanText) {
                throw new Error("Could not extract text content from the URL.");
            }

            // Fix: remove second argument as parseRecipeFromTextWithGemini only expects 1 argument
            const recipeData = await parseRecipeFromTextWithGemini(cleanText);
            onRecipeImported({ ...recipeData, category });

        } catch (err: any) {
            console.error(err);
            setError('Failed to import the recipe. The AI could not parse this URL. Please try another or add the recipe manually.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Import Recipe from URL</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon />
                    </button>
                </div>
                <form onSubmit={handleImport}>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">Recipe URL</label>
                                <input 
                                    type="url" 
                                    id="url" 
                                    value={url} 
                                    onChange={e => setUrl(e.target.value)} 
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                                    placeholder="https://www.example.com/your-favorite-recipe"
                                    required 
                                />
                            </div>
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Assign to Category</label>
                                 <select id="category" value={category} onChange={e => setCategory(e.target.value as RecipeCategory)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                    {Object.values(RecipeCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>

                         {error && (
                            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                                <p className="font-bold">Import Failed</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}
                        <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                            <p>Paste a link and select a category. Our AI will extract the details and suggest tags for you to review.</p>
                        </div>
                    </div>
                    <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center">
                            {isLoading ? <LoadingIcon /> : <ImportIcon />}
                            <span className="ml-2">{isLoading ? 'Importing...' : 'Import & Review'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ImportRecipeModal;
