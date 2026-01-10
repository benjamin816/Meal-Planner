import React from 'react';
import { Recipe } from '../types';
import { XIcon, TrashIcon, MagicWandIcon, CheckIcon } from './Icons';

interface TrashBinModalProps {
    binRecipes: Recipe[];
    onClose: () => void;
    onRestore: (id: string) => void;
    onRestoreAll: () => void;
    onPermanentDelete: (id: string) => void;
}

const TrashBinModal: React.FC<TrashBinModalProps> = ({ binRecipes, onClose, onRestore, onRestoreAll, onPermanentDelete }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[130] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Trash Bin</h2>
                        <p className="text-xs font-bold text-red-600 uppercase tracking-[0.2em] mt-1">Automatic deletion after 7 days</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all"><XIcon className="w-6 h-6 text-gray-400"/></button>
                </div>
                
                <div className="p-8 overflow-y-auto flex-grow">
                    {binRecipes.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <div className="bg-gray-50 p-6 rounded-full mb-4">
                                <TrashIcon className="w-12 h-12 text-gray-200" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest">Trash is Empty</h3>
                            <p className="text-sm text-gray-300 font-medium mt-2">Deleted recipes will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-6">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{binRecipes.length} Items in Bin</p>
                                <button 
                                    onClick={onRestoreAll}
                                    className="text-xs font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                                >
                                    Restore All
                                </button>
                            </div>
                            {binRecipes.map(recipe => {
                                const deletedDate = recipe.deletedAt ? new Date(recipe.deletedAt) : new Date();
                                const daysRemaining = 7 - Math.floor((new Date().getTime() - deletedDate.getTime()) / (1000 * 3600 * 24));

                                return (
                                    <div key={recipe.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center group transition-all hover:border-blue-200">
                                        <div className="flex-grow pr-4">
                                            <h4 className="font-black text-lg text-gray-800 line-clamp-1">{recipe.name}</h4>
                                            <div className="flex gap-4 mt-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deleted: {deletedDate.toLocaleDateString()}</p>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${daysRemaining <= 2 ? 'text-red-500' : 'text-orange-500'}`}>
                                                    Clears in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => onRestore(recipe.id)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5"
                                            >
                                                <MagicWandIcon className="w-3.5 h-3.5" />
                                                Restore
                                            </button>
                                            <button 
                                                onClick={() => onPermanentDelete(recipe.id)}
                                                className="bg-white border border-red-100 text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"
                                                title="Permanent Delete"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <button 
                        onClick={onClose}
                        className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black shadow-lg active:scale-95 transition-all"
                    >
                        Close Bin
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrashBinModal;