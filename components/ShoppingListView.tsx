

import React, { useState } from 'react';
import { ShoppingListCategory, ShoppingListItem, Settings } from '../types';
import { ShoppingCartIcon, CheckIcon, PlusIcon, TrashIcon, MagicWandIcon, XIcon, CopyIcon, LoadingIcon } from './Icons';
import { generateShoppingAgentInstructions, categorizeShoppingItemWithGemini } from '../services/geminiService';

interface ShoppingListViewProps {
  shoppingList: ShoppingListCategory[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingListCategory[]>>;
  settings: Settings;
}

const ShoppingListView: React.FC<ShoppingListViewProps> = ({ shoppingList, setShoppingList, settings }) => {
    const [newItemName, setNewItemName] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);
    
    // Agent Modal State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentStore, setAgentStore] = useState('Walmart');
    const [agentService, setAgentService] = useState('Pickup');
    const [agentDateTime, setAgentDateTime] = useState('');
    const [agentInstructions, setAgentInstructions] = useState('');
    const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    const handleToggleItem = (categoryId: string, itemId: string) => {
        setShoppingList(prev => prev.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
                ...cat,
                items: cat.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
            };
        }));
    };

    const handleDeleteItem = (categoryId: string, itemId: string) => {
        setShoppingList(prev => prev.map(cat => {
            if (cat.id !== categoryId) return cat;
            return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
        }).filter(cat => cat.items.length > 0));
    };

    const handleUpdateItemName = (categoryId: string, itemId: string, newName: string) => {
        setShoppingList(prev => prev.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
                ...cat,
                items: cat.items.map(item => item.id === itemId ? { ...item, name: newName } : item)
            };
        }));
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        setIsAddingItem(true);

        try {
            const categoryToUse = await categorizeShoppingItemWithGemini(newItemName.trim());

            setShoppingList(prev => {
                const existingCatIndex = prev.findIndex(c => c.name.toLowerCase() === categoryToUse.toLowerCase());
                const newItem: ShoppingListItem = {
                    id: `manual_${Date.now()}`,
                    name: newItemName.trim(),
                    checked: false
                };

                if (existingCatIndex >= 0) {
                    const newList = [...prev];
                    newList[existingCatIndex] = {
                        ...newList[existingCatIndex],
                        items: [...newList[existingCatIndex].items, newItem]
                    };
                    return newList;
                } else {
                    return [...prev, {
                        id: `cat_${Date.now()}`,
                        name: categoryToUse,
                        items: [newItem]
                    }];
                }
            });
            setNewItemName('');
        } catch (error) {
            console.error("Error adding item:", error);
            // Fallback to "Other"
             setShoppingList(prev => {
                const categoryToUse = "Other";
                const existingCatIndex = prev.findIndex(c => c.name === categoryToUse);
                const newItem: ShoppingListItem = {
                    id: `manual_${Date.now()}`,
                    name: newItemName.trim(),
                    checked: false
                };

                if (existingCatIndex >= 0) {
                    const newList = [...prev];
                    newList[existingCatIndex] = {
                        ...newList[existingCatIndex],
                        items: [...newList[existingCatIndex].items, newItem]
                    };
                    return newList;
                } else {
                    return [...prev, {
                        id: `cat_${Date.now()}`,
                        name: categoryToUse,
                        items: [newItem]
                    }];
                }
            });
            setNewItemName('');
        } finally {
            setIsAddingItem(false);
        }
    };

    const handleClearList = () => {
        if (window.confirm("Are you sure you want to clear the entire shopping list?")) {
            setShoppingList([]);
        }
    };

    const handleGenerateInstructions = async () => {
        if (!agentDateTime.trim()) {
            alert("Please specify a day and time for pickup or delivery.");
            return;
        }

        setIsGeneratingInstructions(true);
        setAgentInstructions('');
        
        const allItems = shoppingList.flatMap(c => c.items.filter(i => !i.checked).map(i => i.name));
        const goals = settings.people.map(p => `${p.name}: ${JSON.stringify(p.goals)}`).join('; ');

        try {
            const instructions = await generateShoppingAgentInstructions(agentStore, agentService, agentDateTime, allItems, goals);
            setAgentInstructions(instructions);
        } catch (error) {
            console.error("Failed to generate instructions:", error);
            alert("Could not generate instructions. Please try again.");
        } finally {
            setIsGeneratingInstructions(false);
        }
    };

    const handleCopyInstructions = () => {
        navigator.clipboard.writeText(agentInstructions);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2500);
    };
    
    const handleCloseAgentModal = () => {
        setIsAgentModalOpen(false);
        setAgentInstructions('');
        setIsGeneratingInstructions(false);
    };

    const totalItems = shoppingList.reduce((acc, cat) => acc + cat.items.length, 0);
    const checkedItemsCount = shoppingList.reduce((acc, cat) => acc + cat.items.filter(i => i.checked).length, 0);

    return (
        <div className="relative">
            {/* Top Bar Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center">
                    <ShoppingCartIcon className="text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-700 ml-3">Shopping List</h2>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                     <button
                        onClick={handleClearList}
                        className="flex-1 md:flex-none bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg shadow-sm hover:bg-red-50 text-sm font-medium transition-colors flex items-center justify-center"
                    >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Clear List
                    </button>
                    <button
                        onClick={() => setIsAgentModalOpen(true)}
                        disabled={totalItems === 0}
                        className="flex-1 md:flex-none flex items-center justify-center bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 disabled:bg-purple-300 transition-colors font-semibold"
                    >
                        <MagicWandIcon />
                        <span className="ml-2 text-sm">Shop with AI Agent</span>
                    </button>
                </div>
            </div>

            {/* Add Item Form */}
            <form onSubmit={handleAddItem} className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-row gap-3 items-center">
                <div className="flex-grow relative">
                    <input 
                        type="text" 
                        placeholder="Add item (e.g., Almond Milk) - AI will categorize it" 
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        disabled={isAddingItem}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-10"
                    />
                </div>
                <button type="submit" disabled={!newItemName || isAddingItem} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center min-w-[3rem]">
                    {isAddingItem ? <LoadingIcon /> : <PlusIcon className="h-5 w-5" />}
                </button>
            </form>

            {shoppingList.length === 0 && (
                <div className="text-center py-12 px-6 bg-white rounded-lg border-2 border-dashed border-gray-200">
                    <ShoppingCartIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600 font-medium">Your shopping list is empty.</p>
                    <p className="text-gray-500 text-sm mt-2">Generate a meal plan to automatically fill this list, or add items manually above.</p>
                </div>
            )}

            {shoppingList.length > 0 && (
                <>
                    <div className="mb-6 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                        <div className="w-full">
                             <div className="flex justify-between text-xs text-blue-800 mb-1 font-bold uppercase tracking-wide">
                                <span>Progress</span>
                                <span>{checkedItemsCount} / {totalItems} items</span>
                             </div>
                            <div className="w-full bg-blue-200 rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(checkedItemsCount / totalItems) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 masonry-grid">
                        {shoppingList.map((category) => (
                            <div key={category.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3 flex justify-between items-center">
                                    {category.name}
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-mono">{category.items.length}</span>
                                </h3>
                                <ul className="space-y-2">
                                    {category.items.map((item) => (
                                        <li key={item.id} className="flex items-center group">
                                            <label className="flex items-center cursor-pointer w-full relative">
                                                <input 
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => handleToggleItem(category.id, item.id)}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 shrink-0 transition-all duration-200 ${item.checked ? 'bg-green-500 border-green-500 scale-110' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                                                    {item.checked && <CheckIcon className="text-white w-3 h-3" />}
                                                </div>
                                                <input 
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleUpdateItemName(category.id, item.id, e.target.value)}
                                                    className={`w-full bg-transparent border-none focus:ring-0 p-0 text-sm transition-colors ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                                                />
                                            </label>
                                            <button 
                                                onClick={() => handleDeleteItem(category.id, item.id)}
                                                className="ml-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Remove item"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Shop with AI Agent Modal */}
            {isAgentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                            <div className="flex items-center">
                                <div className="bg-purple-100 p-2 rounded-lg mr-3">
                                    <MagicWandIcon className="text-purple-600 w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Shop with AI Agent</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Generate detailed instructions for your autonomous browser agent.</p>
                                </div>
                            </div>
                            <button onClick={handleCloseAgentModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow">
                            <div className="space-y-6">
                                {/* Step 1: Store Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Grocery Store</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Aldi', 'Target', 'Walmart'].map(store => (
                                            <button
                                                key={store}
                                                onClick={() => setAgentStore(store)}
                                                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                                                    agentStore === store 
                                                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' 
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                {store}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 2: Service Type */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">2. Service Type</label>
                                    <div className="flex gap-4 bg-gray-50 p-1 rounded-lg inline-flex">
                                        {['Pickup', 'Delivery'].map(service => (
                                            <button
                                                key={service}
                                                onClick={() => setAgentService(service)}
                                                className={`py-2 px-6 rounded-md text-sm font-medium transition-all ${
                                                    agentService === service
                                                    ? 'bg-white text-gray-800 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                {service}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 3: Date/Time */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">3. Day & Time</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., Tomorrow at 5pm, Friday Morning" 
                                        value={agentDateTime} 
                                        onChange={e => setAgentDateTime(e.target.value)} 
                                        className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500 py-3"
                                    />
                                </div>

                                {/* Generate Button */}
                                {!agentInstructions && (
                                    <button 
                                        onClick={handleGenerateInstructions}
                                        disabled={isGeneratingInstructions || !agentDateTime}
                                        className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:shadow-none transition-all flex items-center justify-center mt-4"
                                    >
                                        {isGeneratingInstructions ? <LoadingIcon /> : <MagicWandIcon />}
                                        <span className="ml-2">{isGeneratingInstructions ? 'Generating Instructions...' : 'Generate Agent Instructions'}</span>
                                    </button>
                                )}

                                {/* Result Area */}
                                {agentInstructions && (
                                    <div className="mt-6 animate-fade-in">
                                        <div className="flex justify-between items-end mb-2">
                                            <label className="block text-sm font-bold text-gray-700">Agent Instructions</label>
                                            {showCopySuccess && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Copied to clipboard!</span>}
                                        </div>
                                        <div className="relative">
                                            <textarea
                                                readOnly
                                                value={agentInstructions}
                                                className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-mono leading-relaxed focus:outline-none resize-none"
                                            />
                                            <button
                                                onClick={handleCopyInstructions}
                                                className="absolute bottom-3 right-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center transition-colors"
                                            >
                                                <CopyIcon className="w-3 h-3 mr-1.5" />
                                                Copy to Clipboard
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3">
                                            This instruction is optimized for an autonomous agent. It includes health goals, price constraints, and explicit steps to handle login and cart confirmation.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer (Only if instructions generated, to allow close) */}
                         {agentInstructions && (
                            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
                                <button 
                                    onClick={handleCloseAgentModal}
                                    className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShoppingListView;