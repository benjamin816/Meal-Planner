
import React, { useState, useCallback } from 'react';
import { Recipe, RecipeCategory, RecipeTag, GeneratedRecipeData } from '../types';
import RecipeListView from './RecipeListView';
import AddRecipeModal from './AddRecipeModal';
import ImportRecipeModal from './ImportRecipeModal';
import GenerateRecipeModal from './GenerateRecipeModal';
import BulkImportModal from './BulkImportModal';
import { PlusIcon, UploadIcon } from './Icons';

interface MealsViewProps {
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => void;
  isLoading: boolean;
  allTags: Record<RecipeCategory, RecipeTag[]>;
  bulkImportRecipes: (
    documentText: string,
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string) => void,
    onComplete: (count: number) => void
  ) => Promise<void>;
}

type ModalType = 'add' | 'import' | 'generate' | 'bulk' | null;

const MealsView: React.FC<MealsViewProps> = ({ recipes, addRecipe, updateRecipe, deleteRecipe, isLoading, allTags, bulkImportRecipes }) => {
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [recipeToEdit, setRecipeToEdit] = useState<Recipe | undefined>(undefined);
    const [prefilledData, setPrefilledData] = useState<GeneratedRecipeData | null>(null);
    
    const handleAddRecipeClick = () => {
        setRecipeToEdit(undefined);
        setPrefilledData(null);
        setActiveModal('add');
    };

    const handleEditRecipe = (recipe: Recipe) => {
        setRecipeToEdit(recipe);
        setPrefilledData(null);
        setActiveModal('add');
    };

    const handleDeleteRecipe = (recipeId: string) => {
        if (window.confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
            deleteRecipe(recipeId);
        }
    };

    const closeModal = useCallback(() => {
        setActiveModal(null);
        setRecipeToEdit(undefined);
        setPrefilledData(null);
    }, []);

    const handleRecipeImported = (data: GeneratedRecipeData) => {
        setPrefilledData(data);
        setActiveModal('add');
    };
    
    const handleRecipeGenerated = (data: GeneratedRecipeData) => {
        setPrefilledData(data);
        setActiveModal('add');
    };

    const handleOnAddRecipe = async (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => {
        await addRecipe(recipe);
        closeModal();
    };

    const handleOnUpdateRecipe = async (recipe: Recipe) => {
        await updateRecipe(recipe);
        closeModal();
    };

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-700">My Recipes ({recipes.length})</h2>
            <div className="flex items-center gap-x-2">
                 <button onClick={() => setActiveModal('bulk')} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 disabled:bg-green-300 transition-colors">
                    <UploadIcon />
                    <span className="ml-2 text-sm">Bulk Import</span>
                </button>
                <button onClick={handleAddRecipeClick} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                    <PlusIcon />
                    <span className="ml-2 text-sm">Add Recipe</span>
                </button>
            </div>
        </div>
        
        <RecipeListView 
            recipes={recipes}
            onSelectRecipe={() => {}} // Selecting does nothing in this view, could open details in future
            onEditRecipe={handleEditRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            allTags={allTags}
        />

        {activeModal === 'add' && (
            <AddRecipeModal 
                onClose={closeModal}
                onAddRecipe={handleOnAddRecipe}
                onUpdateRecipe={handleOnUpdateRecipe}
                isLoading={isLoading}
                allTags={allTags}
                recipeToEdit={recipeToEdit}
                prefilledData={prefilledData}
                onSwitchToImport={() => setActiveModal('import')}
                onSwitchToGenerate={() => setActiveModal('generate')}
            />
        )}
        
        {activeModal === 'import' && (
            <ImportRecipeModal
                onClose={closeModal}
                onRecipeImported={handleRecipeImported}
                allTags={allTags}
            />
        )}

        {activeModal === 'generate' && (
            <GenerateRecipeModal
                onClose={closeModal}
                onRecipeGenerated={handleRecipeGenerated}
                allTags={allTags}
            />
        )}

        {activeModal === 'bulk' && (
            <BulkImportModal 
                onClose={closeModal}
                onBulkImport={bulkImportRecipes}
            />
        )}
    </div>
  );
};

export default MealsView;
