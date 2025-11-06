
import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory, RecipeTag } from '../types';
import RecipeCard from './RecipeCard';

interface RecipeListViewProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  allTags: Record<RecipeCategory, RecipeTag[]>;
}

const RecipeListView: React.FC<RecipeListViewProps> = ({ recipes, onSelectRecipe, onEditRecipe, onDeleteRecipe, allTags }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'All'>('All');
  const [selectedTags, setSelectedTags] = useState<RecipeTag[]>([]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const searchMatch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = selectedCategory === 'All' || recipe.category === selectedCategory;
      const tagMatch = selectedTags.length === 0 || selectedTags.every(tag => recipe.tags.includes(tag));
      return searchMatch && categoryMatch && tagMatch;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [recipes, searchTerm, selectedCategory, selectedTags]);

  const availableTags = useMemo(() => {
    if (selectedCategory === 'All') {
        const all = new Set<RecipeTag>();
        Object.values(allTags).forEach(tagList => tagList.forEach(t => all.add(t)));
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
            {filteredRecipes.map(recipe => (
                <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onSelect={onSelectRecipe}
                    onEdit={onEditRecipe}
                    onDelete={onDeleteRecipe}
                />
            ))}
        </div>
        {filteredRecipes.length === 0 && (
             <div className="text-center py-12 px-6 bg-gray-50 rounded-lg col-span-full">
                <p className="text-gray-600 font-semibold">No recipes found.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or adding a new recipe.</p>
            </div>
        )}
    </div>
  );
};

export default RecipeListView;
