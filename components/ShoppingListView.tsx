
import React, { useState, useEffect, useMemo } from 'react';
import { MealPlan, Recipe } from '../types';
import { generateShoppingListWithGemini } from '../services/geminiService';
import { LoadingIcon, ShoppingCartIcon, GenerateIcon, CheckIcon } from './Icons';

interface ShoppingListItem {
    item: string;
    checked: boolean;
}

interface ShoppingListCategory {
    category: string;
    items: ShoppingListItem[];
}

interface ShoppingListViewProps {
  mealPlan: MealPlan;
}

const ShoppingListView: React.FC<ShoppingListViewProps> = ({ mealPlan }) => {
    const [shoppingList, setShoppingList] = useState<ShoppingListCategory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedList = localStorage.getItem('mealPlannerShoppingList');
        if (storedList) {
            setShoppingList(JSON.parse(storedList));
        }
    }, []);

    useEffect(() => {
        if (shoppingList.length > 0) {
            localStorage.setItem('mealPlannerShoppingList', JSON.stringify(shoppingList));
        }
    }, [shoppingList]);

    const upcomingMeals: Recipe[] = useMemo(() => {
        const meals: Recipe[] = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            const dayPlan = mealPlan.get(dateString);
            if (dayPlan) {
                if (dayPlan.breakfast) meals.push(dayPlan.breakfast);
                if (dayPlan.lunch) meals.push(dayPlan.lunch);
                if (dayPlan.dinner) meals.push(dayPlan.dinner);
                if (dayPlan.snack) meals.push(dayPlan.snack);
            }
        }
        return meals;
    }, [mealPlan]);

    const handleGenerateList = async () => {
        setIsLoading(true);
        setError(null);

        if (upcomingMeals.length === 0) {
            setError("No meals planned for the upcoming week. Please generate a plan first.");
            setIsLoading(false);
            return;
        }

        const allIngredients = upcomingMeals.map(meal => meal.ingredients).join('\n');

        try {
            const categorizedList = await generateShoppingListWithGemini(allIngredients);
            
            // Get currently checked items to preserve state
            const checkedItems = new Set<string>();
            shoppingList.forEach(category => {
                category.items.forEach(item => {
                    if (item.checked) {
                        checkedItems.add(item.item.toLowerCase());
                    }
                });
            });

            const newList: ShoppingListCategory[] = categorizedList.map(category => ({
                category: category.category,
                items: category.items.map(item => ({
                    item: item,
                    checked: checkedItems.has(item.toLowerCase()),
                })).sort((a,b) => a.item.localeCompare(b.item))
            }));
            setShoppingList(newList.sort((a,b) => a.category.localeCompare(b.category)));
        } catch (err) {
            setError("Failed to generate shopping list from AI. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleItem = (categoryIndex: number, itemIndex: number) => {
        setShoppingList(prevList => {
            const newList = [...prevList];
            const category = { ...newList[categoryIndex] };
            const items = [...category.items];
            const item = { ...items[itemIndex] };
            item.checked = !item.checked;
            items[itemIndex] = item;
            category.items = items;
            newList[categoryIndex] = category;
            return newList;
        });
    };
    
    const totalItems = shoppingList.reduce((acc, cat) => acc + cat.items.length, 0);
    const checkedItemsCount = shoppingList.reduce((acc, cat) => acc + cat.items.filter(i => i.checked).length, 0);

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center">
                    <ShoppingCartIcon />
                    <h2 className="text-2xl font-bold text-gray-700 ml-3">Shopping List</h2>
                </div>
                <button
                    onClick={handleGenerateList}
                    disabled={isLoading}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                    {isLoading ? <LoadingIcon /> : <GenerateIcon />}
                    <span className="ml-2 text-sm">{isLoading ? 'Generating...' : 'Generate from Week Plan'}</span>
                </button>
            </div>
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert" onClick={() => setError(null)}>{error}</div>}

            {shoppingList.length === 0 && !isLoading && (
                <div className="text-center py-12 px-6 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Your shopping list is empty.</p>
                    <p className="text-gray-500 text-sm mt-2">Click the "Generate" button to create a list from your planned meals for the next 7 days.</p>
                </div>
            )}
            
            {shoppingList.length > 0 && (
                 <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${totalItems > 0 ? (checkedItemsCount / totalItems) * 100 : 0}%` }}></div>
                    </div>
                    <p className="text-center text-sm text-gray-600 mt-2">{checkedItemsCount} of {totalItems} items checked</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shoppingList.map((category, catIndex) => (
                    <div key={category.category} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">{category.category}</h3>
                        <ul className="space-y-2">
                            {category.items.map((item, itemIndex) => (
                                <li key={`${item.item}-${itemIndex}`} className="flex items-center">
                                    <label className="flex items-center cursor-pointer w-full group">
                                        <input 
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => handleToggleItem(catIndex, itemIndex)}
                                            className="hidden"
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${item.checked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400 group-hover:border-gray-600'}`}>
                                            {item.checked && <CheckIcon />}
                                        </div>
                                        <span className={`text-gray-700 transition-colors ${item.checked ? 'line-through text-gray-400' : ''}`}>{item.item}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default ShoppingListView;
