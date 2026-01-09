
import React, { useState, useCallback, useRef } from 'react';
import { Recipe, RecipeCategory, RecipeTag, GeneratedRecipeData, BulkParsedRecipe } from '../types';
import RecipeListView from './RecipeListView';
import ImportRecipeModal from './ImportRecipeModal';
import GenerateRecipeModal from './GenerateRecipeModal';
import BulkImportModal from './BulkImportModal';
import { PlusIcon, UploadIcon, ExportIcon, MagicWandIcon } from './Icons';

declare global {
  interface Window {
    jspdf: {
      jsPDF: new (options?: any) => any;
    };
  }
}

interface MealsViewProps {
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, 'id' | 'macros' | 'healthScore' | 'scoreReasoning'>) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => void;
  deleteAllRecipes: () => void;
  isLoading: boolean;
  allTags: Record<RecipeCategory, RecipeTag[]>;
  bulkImportRecipes: (
    sourceFile: File,
    importMode: 'full_recipes' | 'meal_ideas',
    onProgress: (message: string, percentage: number) => void,
    onComplete: (count: number) => void,
    onAbortSignal: { isCancelled: boolean }
  ) => Promise<void>;
  onEnterKitchenMode: (recipe: Recipe) => void;
  handleEditRecipe: (recipe: Recipe) => void;
  onOpenAddRecipeModal: () => void;
  onDetectSimilar: () => void;
  onSetDefaultDrink?: (id: string) => void;
}

type ModalType = 'import' | 'generate' | 'bulk' | null;

const MealsView: React.FC<MealsViewProps> = ({ 
    recipes, addRecipe, updateRecipe, deleteRecipe, deleteAllRecipes, 
    isLoading, allTags, bulkImportRecipes, onEnterKitchenMode, handleEditRecipe,
    onOpenAddRecipeModal, onDetectSimilar, onSetDefaultDrink
}) => {
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [prefilledData, setPrefilledData] = useState<GeneratedRecipeData | null>(null);
    const [devClickCount, setDevClickCount] = useState(0);
    const devClickTimeout = useRef<number | null>(null);
    
    const handleDeleteRecipe = (recipeId: string) => {
        if (window.confirm('Are you sure you want to delete this recipe and all its variations? This action cannot be undone.')) {
            deleteRecipe(recipeId);
        }
    };

    const closeModal = useCallback(() => {
        setActiveModal(null);
        setPrefilledData(null);
    }, []);
    
    const handleRecipeGenerated = (data: GeneratedRecipeData) => {
        setPrefilledData(data);
        closeModal();
    };

    const handleDevTitleClick = () => {
        if (devClickTimeout.current) {
            window.clearTimeout(devClickTimeout.current);
        }

        const newCount = devClickCount + 1;
        setDevClickCount(newCount);

        if (newCount >= 5) {
            if (window.confirm('SECRET DEV MODE: Are you sure you want to delete ALL recipes? This cannot be undone.')) {
                deleteAllRecipes();
                alert('All recipes have been deleted.');
            }
            setDevClickCount(0);
        } else {
            devClickTimeout.current = window.setTimeout(() => {
                setDevClickCount(0);
            }, 1500); // Reset after 1.5 seconds of inactivity
        }
    };

    const handleExportToPdf = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const usableWidth = pageWidth - margin * 2;
        let y = margin;

        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        };

        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text("My Recipe Collection", pageWidth / 2, y, { align: 'center' });
        y += 20;

        recipes.forEach((recipe, index) => {
            if (recipe.baseRecipeId) return; // Only print base recipes

            checkPageBreak(60); // Estimate for recipe header

            // Recipe Name
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(recipe.name, margin, y);
            y += 8;

            // Category and Tags
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100);
            const tags = recipe.tags || [];
            
            // Add metadata for AI detection upon re-import
            const metaTag = `[META: intensity=${recipe.usageIntensity || 'normal'} healthScore=${recipe.healthScore || 5}]`;
            const tagText = `Category: ${recipe.category}${tags.length > 0 ? `  |  Tags: ${tags.join(', ')}` : ''}  |  Intensity: ${recipe.usageIntensity || 'normal'}`;
            
            const splitTagText = doc.splitTextToSize(`${tagText}\n${metaTag}`, usableWidth);
            doc.text(splitTagText, margin, y);
            y += (splitTagText.length * 4) + 6;
            doc.setTextColor(0);

            // Ingredients
            checkPageBreak(20);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("Ingredients", margin, y);
            y += 7;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const ingredientsLines = doc.splitTextToSize(recipe.ingredients, usableWidth);
            ingredientsLines.forEach((line: string) => {
                checkPageBreak(5);
                doc.text(`• ${line}`, margin, y);
                y += 6;
            });
            y += 6;

            // Instructions
            checkPageBreak(20);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("Instructions", margin, y);
            y += 7;
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const instructionsLines = doc.splitTextToSize(recipe.instructions.replace(/\n/g, '\n\n'), usableWidth);
            instructionsLines.forEach((line: string, lineIndex: number) => {
                checkPageBreak(5);
                const startsWithNumber = /^\d+\.\s/.test(line);
                const lineContent = `${!startsWithNumber && line.trim() ? `${lineIndex + 1}. ` : ''}${line}`;
                doc.text(lineContent, margin, y, { maxWidth: usableWidth });
                y += 6;
            });
            
            if (index < recipes.length - 1) {
                y += 10;
                checkPageBreak(15);
                doc.setDrawColor(200, 200, 200);
                doc.line(margin, y, pageWidth - margin, y);
                y += 15;
            }
        });

        doc.save("my-recipes.pdf");
    };

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 onClick={handleDevTitleClick} className="text-2xl font-bold text-gray-700 cursor-pointer" title="Developer options available...">My Recipes ({recipes.filter(r => !r.baseRecipeId).length})</h2>
            <div className="flex flex-wrap items-center justify-center gap-2">
                 <button onClick={onDetectSimilar} disabled={isLoading || recipes.length < 2} className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 disabled:bg-purple-300 transition-colors">
                    <MagicWandIcon className="w-4 h-4" />
                    <span className="ml-2 text-sm">Detect Duplicates</span>
                </button>
                 <button onClick={() => setActiveModal('bulk')} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 disabled:bg-green-300 transition-colors">
                    <UploadIcon />
                    <span className="ml-2 text-sm">Bulk Import</span>
                </button>
                 <button onClick={handleExportToPdf} className="flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-700 disabled:bg-gray-300 transition-colors">
                    <ExportIcon />
                    <span className="ml-2 text-sm">PDF Export</span>
                </button>
                <button onClick={onOpenAddRecipeModal} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                    <PlusIcon />
                    <span className="ml-2 text-sm">Add Recipe</span>
                </button>
            </div>
        </div>
        
        <RecipeListView 
            recipes={recipes}
            onSelectRecipe={onEnterKitchenMode}
            onAiEditRecipe={handleEditRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            allTags={allTags}
            onSetDefaultDrink={onSetDefaultDrink}
        />

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
