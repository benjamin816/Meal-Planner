import React, { useState } from 'react';
import { NutritionGoals } from '../types';
import { suggestNutritionGoalsWithGemini } from '../services/geminiService';
import { XIcon, LoadingIcon, MagicWandIcon } from './Icons';

interface AutoSuggestGoalsModalProps {
    onClose: () => void;
    onGoalsSuggested: (goals: NutritionGoals) => void;
}

const AutoSuggestGoalsModal: React.FC<AutoSuggestGoalsModalProps> = ({ onClose, onGoalsSuggested }) => {
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [age, setAge] = useState(30);
    const [height, setHeight] = useState(165);
    const [weight, setWeight] = useState(60);
    const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('light');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const goals = await suggestNutritionGoalsWithGemini(gender, age, height, weight, activityLevel);
            onGoalsSuggested(goals);
        } catch (err) {
            setError("Could not get a suggestion from the AI. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Auto-Suggest Goals</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">Provide some basic information and our AI will suggest nutrition goals for you based on estimated daily energy needs.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full border-gray-300 rounded-md shadow-sm">
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <input type="number" value={age} onChange={e => setAge(parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                                <input type="number" value={height} onChange={e => setHeight(parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                <input type="number" value={weight} onChange={e => setWeight(parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
                            <select value={activityLevel} onChange={e => setActivityLevel(e.target.value as any)} className="w-full border-gray-300 rounded-md shadow-sm">
                                <option value="sedentary">Sedentary (little to no exercise)</option>
                                <option value="light">Light (exercise 1-3 days/week)</option>
                                <option value="moderate">Moderate (exercise 3-5 days/week)</option>
                                <option value="active">Active (exercise 6-7 days/week)</option>
                                <option value="very_active">Very Active (hard exercise & physical job)</option>
                            </select>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                    <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:bg-purple-300 flex items-center">
                            {isLoading ? <LoadingIcon /> : <MagicWandIcon />}
                            <span className="ml-2">{isLoading ? 'Calculating...' : 'Suggest Goals'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AutoSuggestGoalsModal;
