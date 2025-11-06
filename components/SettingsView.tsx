import React, { useState, useEffect, useRef } from 'react';
import { Settings, RecipeTag, Person, NutritionGoals, RecipeCategory } from '../types';
import { SettingsIcon, MagicWandIcon, XIcon, PlusIcon } from './Icons';
import AutoSuggestGoalsModal from './AutoSuggestGoalsModal';

interface SettingsViewProps {
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    allTags: Record<RecipeCategory, RecipeTag[]>;
    onAllTagsChange: (newAllTags: Record<RecipeCategory, RecipeTag[]>) => void;
}

// New component for interactive tag selection and creation
const InteractiveTagEditor: React.FC<{
    title: string;
    category: RecipeCategory;
    allCategoryTags: RecipeTag[];
    selectedTags: RecipeTag[];
    onTagSelect: (tag: RecipeTag) => void;
    onTagRemove: (tag: RecipeTag) => void;
    onMasterTagCreate: (category: RecipeCategory, tag: RecipeTag) => void;
}> = ({ title, category, allCategoryTags, selectedTags, onTagSelect, onTagRemove, onMasterTagCreate }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);

    const unselectedTags = allCategoryTags.filter(t => !selectedTags.includes(t)).sort();

    const handleAddNewTag = () => {
        const tagToAdd = newTagInput.trim().toLowerCase();
        if (tagToAdd && !allCategoryTags.includes(tagToAdd)) {
            onMasterTagCreate(category, tagToAdd);
            onTagSelect(tagToAdd);
            setNewTagInput('');
            setIsAdding(false);
        } else if (tagToAdd && allCategoryTags.includes(tagToAdd) && !selectedTags.includes(tagToAdd)) {
            onTagSelect(tagToAdd);
            setNewTagInput('');
            setIsAdding(false);
        }
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsAdding(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [popoverRef]);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{title}</label>
            <div className="flex flex-wrap gap-2 p-3 bg-white rounded-md border items-center min-h-[48px]">
                {selectedTags.map(tag => (
                    <span key={tag} className="bg-blue-100 text-blue-800 text-sm font-medium pl-3 pr-1.5 py-1 rounded-full flex items-center">
                        {tag}
                        <button onClick={() => onTagRemove(tag)} className="ml-1.5 text-blue-500 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors">
                            <XIcon className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                
                <div className="relative" ref={popoverRef}>
                    <button 
                        type="button" 
                        onClick={() => setIsAdding(!isAdding)} 
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1 px-3 rounded-md text-sm"
                    >
                        + Add tag
                    </button>
                    {isAdding && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-white border rounded-lg shadow-xl z-10 p-2">
                             <div className="flex items-center mb-2">
                                <input 
                                    type="text" 
                                    placeholder="Add new tag..." 
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddNewTag();
                                        }
                                    }}
                                    className="flex-grow border-gray-300 rounded-l-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button type="button" onClick={handleAddNewTag} className="bg-blue-600 text-white p-2 rounded-r-md hover:bg-blue-700"><PlusIcon className="h-4 w-4"/></button>
                             </div>
                             {unselectedTags.length > 0 && (
                                <>
                                 <hr className="my-1"/>
                                 <div className="max-h-32 overflow-y-auto">
                                    {unselectedTags.map(tag => (
                                        <button 
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                onTagSelect(tag);
                                                setIsAdding(false);
                                            }}
                                            className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                 </div>
                                </>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsChange, allTags, onAllTagsChange }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const [localAllTags, setLocalAllTags] = useState<Record<RecipeCategory, RecipeTag[]>>(allTags);
    const [isAutoSuggestModalOpen, setIsAutoSuggestModalOpen] = useState(false);
    const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        setLocalAllTags(allTags);
    }, [allTags]);

    const handleSave = () => {
        const finalPeople: Person[] = [];
        for (let i = 0; i < localSettings.numberOfPeople; i++) {
            finalPeople.push(localSettings.people[i] || { name: `Person ${i + 1}`, goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } });
        }
        onSettingsChange({ ...localSettings, people: finalPeople });
        onAllTagsChange(localAllTags);
        alert('Settings saved!');
    };
    
    const handleGenerationTagChange = (action: 'add' | 'remove', tag: RecipeTag, group: keyof Settings['generationTags']) => {
        setLocalSettings(prev => {
            const currentTags = prev.generationTags[group];
            if (action === 'add' && currentTags.includes(tag)) return prev; // Do nothing if tag already exists
            
            const newTags = action === 'add' 
                ? [...currentTags, tag] 
                : currentTags.filter(t => t !== tag);
            return { ...prev, generationTags: { ...prev.generationTags, [group]: newTags }};
        });
    };

    const handleMasterTagCreate = (category: RecipeCategory, tagToAdd: RecipeTag) => {
        if (tagToAdd && !localAllTags[category].includes(tagToAdd)) {
            setLocalAllTags(prev => ({ ...prev, [category]: [...prev[category], tagToAdd].sort() }));
        }
    };

    const handlePersonChange = (index: number, field: keyof Person, value: string) => {
        setLocalSettings(prev => {
            const newPeople = [...prev.people];
            newPeople[index] = { ...newPeople[index], [field]: value };
            return { ...prev, people: newPeople };
        });
    };

    const handleGoalsChange = (personIndex: number, field: keyof NutritionGoals, value: number) => {
        setLocalSettings(prev => {
            const newPeople = [...prev.people];
            const person = newPeople[personIndex];
            person.goals = { ...person.goals, [field]: value };
            return { ...prev, people: newPeople };
        });
    };
    
    const handleSuggestedGoals = (goals: NutritionGoals) => {
        if (editingPersonIndex !== null) {
            handleGoalsChange(editingPersonIndex, 'calories', goals.calories);
            handleGoalsChange(editingPersonIndex, 'protein', goals.protein);
            handleGoalsChange(editingPersonIndex, 'carbs', goals.carbs);
            handleGoalsChange(editingPersonIndex, 'fat', goals.fat);
        }
        setIsAutoSuggestModalOpen(false);
        setEditingPersonIndex(null);
    };

    const generationTagGroups: {
      title: string;
      category: RecipeCategory;
      groupKey: keyof Settings['generationTags'];
    }[] = [
      { title: "Weekday Dinner Tags", category: RecipeCategory.Dinner, groupKey: 'weekdayDinner'},
      { title: "Weekend Dinner Tags", category: RecipeCategory.Dinner, groupKey: 'weekendDinner'},
      { title: "Weekday Breakfast Tags", category: RecipeCategory.Breakfast, groupKey: 'weekdayBreakfast'},
      { title: "Weekend Breakfast Tags", category: RecipeCategory.Breakfast, groupKey: 'weekendBreakfast'},
      { title: "Weekday Snack Tags", category: RecipeCategory.Snack, groupKey: 'weekdaySnack'},
      { title: "Weekend Snack Tags", category: RecipeCategory.Snack, groupKey: 'weekendSnack'},
    ];

    return (
        <div>
            <div className="flex items-center mb-6">
                <SettingsIcon />
                <h2 className="text-2xl font-bold text-gray-700 ml-3">Settings</h2>
            </div>

            <div className="space-y-8">
                {/* Plan Generation Settings */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Plan Generation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Duration (Weeks)</label>
                            <select value={localSettings.planDurationWeeks} onChange={e => setLocalSettings({...localSettings, planDurationWeeks: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-md shadow-sm">
                                {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w} Week{w > 1 ? 's' : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of People</label>
                            <select value={localSettings.numberOfPeople} onChange={e => setLocalSettings({...localSettings, numberOfPeople: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-md shadow-sm">
                                {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p} Person{p > 1 ? 's' : ''}</option>)}
                            </select>
                        </div>
                    </div>
                     <div className="mt-6 p-4 bg-white rounded-md border border-blue-200">
                        <h4 className="text-md font-semibold text-gray-800 mb-2">Dinner & Leftover Settings</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Servings Per Person (Dinners)</label>
                                <select value={localSettings.servingsPerPerson} onChange={e => setLocalSettings(s => ({...s, servingsPerPerson: parseInt(e.target.value)}))} className="w-full border-gray-300 rounded-md shadow-sm">
                                    <option value={1}>1 (No Leftovers)</option>
                                    <option value={2}>2 (Dinner + 1 Leftover)</option>
                                    <option value={3}>3 (Dinner + 2 Leftovers)</option>
                                    <option value={4}>4 (Dinner + 3 Leftovers)</option>
                                </select>
                            </div>
                            {localSettings.servingsPerPerson > 1 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Leftover Placement</label>
                                    <select value={localSettings.leftoverStrategy} onChange={e => setLocalSettings(s => ({...s, leftoverStrategy: e.target.value as any}))} className="w-full border-gray-300 rounded-md shadow-sm">
                                        <option value="next_day">Next Day's Lunch</option>
                                        <option value="day_after">Lunch 2 Days Later</option>
                                        <option value="random">Random Lunch This Week</option>
                                    </select>
                                </div>
                            )}
                        </div>
                         <p className="text-xs text-gray-500 mt-2">These settings only apply to <strong className="text-gray-700">Dinners</strong> to automatically create lunches. Breakfasts and snacks are always single-serving.</p>
                    </div>
                     <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-4">Meals Per Week</h4>
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekday Dinners</label>
                            <input type="number" min="0" max="5" value={localSettings.mealsPerWeek.weekdayDinners} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekdayDinners: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekend Dinners</label>
                            <input type="number" min="0" max="2" value={localSettings.mealsPerWeek.weekendDinners} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekendDinners: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekday Breakfasts</label>
                            <input type="number" min="0" max="5" value={localSettings.mealsPerWeek.weekdayBreakfasts} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekdayBreakfasts: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekend Breakfasts</label>
                            <input type="number" min="0" max="2" value={localSettings.mealsPerWeek.weekendBreakfasts} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekendBreakfasts: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekday Snacks</label>
                            <input type="number" min="0" max="5" value={localSettings.mealsPerWeek.weekdaySnacks} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekdaySnacks: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weekend Snacks</label>
                            <input type="number" min="0" max="2" value={localSettings.mealsPerWeek.weekendSnacks} onChange={e => setLocalSettings(s => ({...s, mealsPerWeek: {...s.mealsPerWeek, weekendSnacks: parseInt(e.target.value)}}))} className="w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                </div>

                {/* Generation Tags */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Meal Generation Tags</h3>
                    <p className="text-sm text-gray-600 mb-4">Select which tags the planner should use to categorize recipes. You can add new tags directly from here.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {generationTagGroups.map(({ title, category, groupKey }) => (
                            <InteractiveTagEditor
                                key={groupKey}
                                title={title}
                                category={category}
                                allCategoryTags={localAllTags[category]}
                                selectedTags={localSettings.generationTags[groupKey]}
                                onTagSelect={(tag) => handleGenerationTagChange('add', tag, groupKey)}
                                onTagRemove={(tag) => handleGenerationTagChange('remove', tag, groupKey)}
                                onMasterTagCreate={handleMasterTagCreate}
                            />
                        ))}
                    </div>
                </div>
                
                {/* People & Nutrition Goals */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">People & Nutrition Goals</h3>
                    <div className="space-y-6">
                        {Array.from({ length: localSettings.numberOfPeople }).map((_, index) => {
                            const person = localSettings.people[index] || { name: `Person ${index + 1}`, goals: { calories: 2000, protein: 30, carbs: 40, fat: 30 } };
                            return (
                                <div key={index} className="p-4 bg-white rounded-lg border">
                                    <div className="flex justify-between items-center mb-4">
                                        <input 
                                            type="text" 
                                            value={person.name} 
                                            onChange={e => handlePersonChange(index, 'name', e.target.value)} 
                                            className="font-semibold text-lg border-b-2 border-transparent focus:border-blue-500 focus:outline-none" 
                                        />
                                        <button onClick={() => { setEditingPersonIndex(index); setIsAutoSuggestModalOpen(true); }} className="text-sm text-purple-600 hover:text-purple-800 font-semibold flex items-center">
                                            <MagicWandIcon />
                                            <span className="ml-1">Auto-Suggest</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Calories</label>
                                            <input type="number" value={person.goals.calories} onChange={e => handleGoalsChange(index, 'calories', parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Protein %</label>
                                            <input type="number" value={person.goals.protein} onChange={e => handleGoalsChange(index, 'protein', parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Carbs %</label>
                                            <input type="number" value={person.goals.carbs} onChange={e => handleGoalsChange(index, 'carbs', parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Fat %</label>
                                            <input type="number" value={person.goals.fat} onChange={e => handleGoalsChange(index, 'fat', parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="flex justify-end mt-8">
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors font-semibold">
                        Save Settings
                    </button>
                </div>
            </div>

            {isAutoSuggestModalOpen && (
                <AutoSuggestGoalsModal 
                    onClose={() => setIsAutoSuggestModalOpen(false)}
                    onGoalsSuggested={handleSuggestedGoals}
                />
            )}
        </div>
    );
};

export default SettingsView;
