
import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory, RecipeTag } from '../types';
import RecipeCard from './RecipeCard';

interface RecipeListViewProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onAiEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  allTags: Record<RecipeCategory, RecipeTag[]>;
}

const RecipeGroupCard: React.FC<{
    baseRecipe: Recipe;
    variations: Recipe[];
    onSelectRecipe: (recipe: Recipe) => void;
    onAiEditRecipe: (recipe: Recipe) => void;
    onDeleteRecipe: (recipeId: string) => void;
}> = ({ baseRecipe, variations, ...props }) => {
    const allVersions = [baseRecipe, ...variations];
    const [activeVariationId, setActiveVariationId] = useState(baseRecipe.id);
    const activeVariation = allVersions.find(r => r.id === activeVariationId) || baseRecipe;

    return (
        <div className="flex flex-col">
            {allVersions.length > 1 && (
                 <div className="p-3 bg-gray-50 border border-b-0 border-gray-200 rounded-t-lg">
                     <label htmlFor={`variation-select-${baseRecipe.id}`} className="block text-xs font-medium text-gray-500 mb-1">
                         Select Variation:
                     </label>
                    <select
                        id={`variation-select-${baseRecipe.id}`}
                        value={activeVariationId}
                        onChange={e => setActiveVariationId(e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option key={baseRecipe.id} value={baseRecipe.id}>
                           {baseRecipe.name} (Original)
                        </option>
                        {variations.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <RecipeCard 
                recipe={activeVariation}
                onSelect={props.onSelectRecipe}
                onAiEdit={props.onAiEditRecipe}
                onDelete={props.onDeleteRecipe}
            />
        </div>
    );
};


const RecipeListView: React.FC<RecipeListViewProps> = ({ recipes, onSelectRecipe, onAiEditRecipe, onDeleteRecipe, allTags }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'All'>('All');
  const [selectedTags, setSelectedTags] = useState<RecipeTag[]>([]);

  const recipeGroups = useMemo(() => {
    const groups = new Map<string, { base: Recipe; variations: Recipe[] }>();
    
    // Initialize groups with base recipes
    recipes.forEach(r => {
        if (!r.baseRecipeId) {
            groups.set(r.id, { base: r, variations: [] });
        }
    });

    // Add variations to their respective groups
    recipes.forEach(r => {
        if (r.baseRecipeId && groups.has(r.baseRecipeId)) {
            groups.get(r.baseRecipeId)!.variations.push(r);
        }
    });
    
    // Filter the groups
    const filteredGroups = Array.from(groups.values()).filter(group => {
        const allVariations = [group.base, ...group.variations];
        const searchMatch = group.base.name.toLowerCase().includes(searchTerm.toLowerCase());
        const categoryMatch = selectedCategory === 'All' || group.base.category === selectedCategory;
        const tagMatch = selectedTags.length === 0 || selectedTags.every(tag => allVariations.some(v => v.tags.includes(tag)));
        return searchMatch && categoryMatch && tagMatch;
    });

    return filteredGroups.sort((a,b) => a.base.name.localeCompare(b.base.name));
  }, [recipes, searchTerm, selectedCategory, selectedTags]);

  const availableTags = useMemo(() => {
    if (selectedCategory === 'All') {
        const all = new Set<RecipeTag>();
        // Fix: Property 'forEach' does not exist on type 'unknown'.
        (Object.values(allTags) as RecipeTag[][]).forEach(tagList => tagList.forEach(t => all.add(t)));
        return Array.from(all).sort();
    }
    return allTags[selectedCategory] || [];
  }, [allTags, selectedCategory]);

  const handleTagClick = (tag: RecipeTag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div>
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                    type="text"
                    placeholder="Search recipes..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm"
                />
                <select 
                    value={selectedCategory} 
                    onChange={e => setSelectedCategory(e.target.value as any)}
                    className="w-full border-gray-300 rounded-md shadow-sm"
                >
                    <option value="All">All Categories</option>
                    {Object.values(RecipeCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tags:</label>
                <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                         <button type="button" key={tag} onClick={() => handleTagClick(tag)} className={`py-1 px-3 rounded-full text-sm transition-colors ${selectedTags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipeGroups.map(group => (
                <RecipeGroupCard
                    key={group.base.id}
                    baseRecipe={group.base}
                    variations={group.variations}
                    onSelectRecipe={onSelectRecipe}
                    onAiEditRecipe={onAiEditRecipe}
                    onDeleteRecipe={onDeleteRecipe}
                />
            ))}
        </div>
        {recipeGroups.length === 0 && (
             <div className="text-center py-12 px-6 bg-gray-50 rounded-lg col-span-full">
                <p className="text-gray-600 font-semibold">No recipes found.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or adding a new recipe.</p>
            </div>
        )}
    </div>
  );
};

export default RecipeListView;
