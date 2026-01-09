
import React, { useState } from 'react';
import { Recipe, SimilarityGroup } from '../types';
import { XIcon, TrashIcon, CheckIcon } from './Icons';

interface DuplicateDetectionModalProps {
    groups: SimilarityGroup[];
    recipes: Recipe[];
    onClose: () => void;
    onDeleteRecipe: (id: string) => void;
}

const DuplicateDetectionModal: React.FC<DuplicateDetectionModalProps> = ({ groups, recipes, onClose, onDeleteRecipe }) => {
    const [resolvedGroupIds, setResolvedGroupIds] = useState<Set<number>>(new Set());

    const getRecipeById = (id: string) => recipes.find(r => r.id === id);

    const handleDelete = (groupId: number, recipeId: string) => {
        if (window.confirm("Delete this similar recipe? This cannot be undone.")) {
            onDeleteRecipe(recipeId);
            // Since we deleted a recipe, this group might be "resolved" if only 1 recipe remains
            // but for UX let's just mark the group as resolved if the user wants.
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in border border-gray-100 flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-gray-100 bg-purple-50/50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Similar Recipes Detected</h2>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mt-1">AI Library Scan Result</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"><XIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    {groups.length === 0 ? (
                        <div className="text-center py-10">
                            <CheckIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-600 font-bold">Your library looks great! No similar recipes found.</p>
                        </div>
                    ) : (
                        groups.map((group, idx) => {
                            if (resolvedGroupIds.has(idx)) return null;
                            const primary = getRecipeById(group.primaryRecipeId);
                            const similars = group.similarRecipeIds.map(id => getRecipeById(id)).filter(Boolean) as Recipe[];

                            if (!primary || similars.length === 0) return null;

                            return (
                                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 shadow-sm">
                                    <div className="mb-4">
                                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">AI Reasoning</p>
                                        <p className="text-sm font-medium text-gray-600 italic">"{group.reasoning}"</p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                                            <div>
                                                <p className="text-xs font-black text-blue-400 uppercase leading-none mb-1">Base</p>
                                                <p className="font-black text-gray-800">{primary.name}</p>
                                            </div>
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-black uppercase">KEEPING</span>
                                        </div>

                                        {similars.map(sim => (
                                            <div key={sim.id} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center group transition-all">
                                                <div>
                                                    <p className="text-xs font-black text-red-400 uppercase leading-none mb-1">Similar</p>
                                                    <p className="font-black text-gray-800">{sim.name}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleDelete(idx, sim.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100 shadow-sm"
                                                        title="Delete this one"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                        <button 
                                            onClick={() => setResolvedGroupIds(prev => new Set(prev).add(idx))}
                                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600"
                                        >
                                            Dismiss Group
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-6 border-t bg-gray-50 shrink-0 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95"
                    >
                        Done Reviewing
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateDetectionModal;
