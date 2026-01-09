
import React, { useState, useMemo, useEffect } from 'react';
import { MealPlan, Recipe, Settings, PrepWorkflow, PrepWorkflowStep, MealType, PlannedMeal } from '../types';
// Add missing ShoppingCartIcon to imports
import { XIcon, CheckIcon, LoadingIcon, MagicWandIcon, ChevronRightIcon, ChevronLeftIcon, ShoppingCartIcon } from './Icons';
import { generatePrepWorkflowWithGemini } from '../services/geminiService';

interface PrepModePortalProps {
    mealPlan: MealPlan;
    settings: Settings;
    onClose: () => void;
}

const Timer: React.FC<{ minutes: number }> = ({ minutes }) => {
    const [seconds, setSeconds] = useState(minutes * 60);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval: number | null = null;
        if (isActive && seconds > 0) {
            interval = window.setInterval(() => setSeconds(s => s - 1), 1000);
        } else if (seconds === 0) {
            setIsActive(false);
            if (interval) clearInterval(interval);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isActive, seconds]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const remS = s % 60;
        return `${m}:${remS.toString().padStart(2, '0')}`;
    };

    return (
        <button 
            onClick={() => setIsActive(!isActive)}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${isActive ? 'bg-orange-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700'}`}
        >
            {isActive ? `Timer: ${formatTime(seconds)}` : seconds === 0 ? 'Done!' : `Start ${minutes}m Timer`}
        </button>
    );
};

const PrepModePortal: React.FC<PrepModePortalProps> = ({ mealPlan, settings, onClose }) => {
    const [step, setStep] = useState<'selection' | 'generating' | 'execution'>('selection');
    const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
    const [workflow, setWorkflow] = useState<PrepWorkflow | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    const summary = useMemo(() => {
        const recipeTotals = new Map<string, { recipe: Recipe; totalServings: number }>();
        mealPlan.forEach((dayPlan) => {
            if (dayPlan.isMealPrepDay) return;
            (['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).forEach(type => {
                const r = dayPlan[type as keyof PlannedMeal] as Recipe;
                const portions = (dayPlan as any)[`${type}Portions`] as number[] | undefined;
                if (r && portions) {
                    const data = recipeTotals.get(r.id) || { recipe: r, totalServings: 0 };
                    data.totalServings += portions.reduce((a, b) => a + b, 0);
                    recipeTotals.set(r.id, data);
                }
            });
        });
        return Array.from(recipeTotals.values()).sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
    }, [mealPlan]);

    useEffect(() => {
        if (summary.length > 0 && selectedRecipeIds.size === 0) {
            setSelectedRecipeIds(new Set(summary.map(s => s.recipe.id)));
        }
    }, [summary]);

    const handleStartPrep = async () => {
        setStep('generating');
        try {
            const itemsToPrep = summary.filter(s => selectedRecipeIds.has(s.recipe.id));
            const result = await generatePrepWorkflowWithGemini(itemsToPrep);
            setWorkflow(result);
            setStep('execution');
        } catch (error) {
            alert("Failed to generate workflow. Please try again.");
            setStep('selection');
        }
    };

    const toggleRecipe = (id: string) => {
        const next = new Set(selectedRecipeIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedRecipeIds(next);
    };

    const toggleStep = (idx: number) => {
        const next = new Set(completedSteps);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        setCompletedSteps(next);
    };

    if (step === 'selection') {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Weekly Prep Mode</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Select meals to batch prep now</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all"><XIcon className="w-6 h-6 text-gray-400"/></button>
                    </div>
                    <div className="p-8 overflow-y-auto flex-grow space-y-4">
                        {summary.map(item => (
                            <label 
                                key={item.recipe.id} 
                                className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all cursor-pointer ${selectedRecipeIds.has(item.recipe.id) ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 bg-white opacity-60 hover:opacity-100'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedRecipeIds.has(item.recipe.id)} 
                                        onChange={() => toggleRecipe(item.recipe.id)}
                                        className="hidden"
                                    />
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${selectedRecipeIds.has(item.recipe.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                        {selectedRecipeIds.has(item.recipe.id) && <CheckIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800">{item.recipe.name}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.totalServings.toFixed(1)} Servings total</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${selectedRecipeIds.has(item.recipe.id) ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                    {item.recipe.category}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="p-8 bg-gray-50 border-t border-gray-100">
                        <button 
                            disabled={selectedRecipeIds.size === 0}
                            onClick={handleStartPrep}
                            className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black tracking-widest uppercase text-sm shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-300"
                        >
                            <MagicWandIcon className="w-5 h-5 text-blue-400" />
                            Initialize Systematic Workflow
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'generating') {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="text-center space-y-6">
                    <div className="relative">
                        <div className="w-24 h-24 border-8 border-white/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                        <MagicWandIcon className="w-8 h-8 text-white absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Optimizing Your Prep...</h2>
                        <p className="text-blue-200 font-bold uppercase tracking-widest text-xs mt-2">AI is finding ingredient overlaps and action grouping</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-white z-[150] flex flex-col overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setStep('selection')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><ChevronLeftIcon /></button>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Prep Mode Portal</h2>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Efficiency Mode: ON</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Progress</span>
                        <span className="text-sm font-black text-gray-800">{Math.round((completedSteps.size / (workflow?.steps.length || 1)) * 100)}%</span>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-100 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><XIcon className="w-6 h-6"/></button>
                </div>
            </div>

            <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
                {/* Side: Ingredients Checklist */}
                <div className="w-full md:w-80 bg-gray-50 border-r border-gray-100 p-6 overflow-y-auto shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                        Get These Out
                        <ShoppingCartIcon className="w-4 h-4" />
                    </h3>
                    <div className="space-y-3">
                        {workflow?.requiredIngredients.map((ing, idx) => (
                            <label key={idx} className="flex items-start gap-3 p-3 bg-white rounded-2xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors group">
                                <input type="checkbox" className="hidden peer" />
                                <div className="w-4 h-4 rounded border-2 border-gray-200 mt-0.5 peer-checked:bg-green-500 peer-checked:border-green-500 flex items-center justify-center transition-all">
                                    <CheckIcon className="w-2.5 h-2.5 text-white" />
                                </div>
                                <span className="text-xs font-bold text-gray-600 peer-checked:line-through peer-checked:text-gray-300 leading-tight">{ing}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Main: Steps */}
                <div className="flex-grow p-8 overflow-y-auto bg-white">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                             <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.2em]">Execution Steps</h3>
                             <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase">Batch Grouped</span>
                        </div>
                        
                        <div className="space-y-12">
                            {workflow?.steps.map((step, idx) => (
                                <div key={idx} className={`relative flex items-start gap-6 group transition-all ${completedSteps.has(idx) ? 'opacity-40' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <button 
                                            onClick={() => toggleStep(idx)}
                                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg transform active:scale-90 transition-all ${completedSteps.has(idx) ? 'bg-green-500 text-white' : 'bg-white text-gray-400 border-2 border-gray-100 group-hover:border-blue-400 group-hover:text-blue-600'}`}
                                        >
                                            {completedSteps.has(idx) ? <CheckIcon className="w-6 h-6" /> : (idx + 1)}
                                        </button>
                                        {idx < workflow.steps.length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-4"></div>}
                                    </div>
                                    <div className="flex-grow pt-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                                step.type === 'prep' ? 'bg-blue-100 text-blue-600' :
                                                step.type === 'cooking' ? 'bg-red-100 text-red-600' :
                                                step.type === 'storage' ? 'bg-purple-100 text-purple-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {step.type}
                                            </span>
                                            <Timer minutes={step.estimatedMinutes} />
                                        </div>
                                        <h4 className="text-xl font-black text-gray-800 leading-tight mb-2">{step.title}</h4>
                                        <p className="text-gray-600 font-medium leading-relaxed">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-20 p-12 bg-green-50 rounded-[3rem] border-2 border-green-100 text-center">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                                <CheckIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-green-900 tracking-tight">Prep Complete!</h3>
                            <p className="text-green-700 font-medium mt-2">Everything is prepped, portioned, and ready for your week.</p>
                            <button 
                                onClick={onClose}
                                className="mt-8 px-10 py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 shadow-lg active:scale-95 transition-all"
                            >
                                Close Prep Portal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrepModePortal;
