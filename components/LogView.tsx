
import React, { useMemo } from 'react';
import { EatenLog, MealPlan, Recipe, MealType } from '../types';

interface LogViewProps {
  eatenLog: EatenLog;
  mealPlan: MealPlan;
}

const LogView: React.FC<LogViewProps> = ({ eatenLog, mealPlan }) => {
    
    const loggedEntries = useMemo(() => {
        const entries: { date: string, mealType: MealType, recipe: Recipe }[] = [];
        
        // Sort dates descending
        const sortedDates = Array.from(eatenLog.keys()).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
        
        for (const dateString of sortedDates) {
            const dayLog = eatenLog.get(dateString);
            if (dayLog) {
                const dayPlan = mealPlan.get(dateString);
                for (const mealType of Object.keys(dayLog) as MealType[]) {
                    if (dayLog[mealType] && dayPlan?.[mealType]) {
                        entries.push({
                            date: dateString,
                            mealType,
                            recipe: dayPlan[mealType]!
                        });
                    }
                }
            }
        }
        return entries;
    }, [eatenLog, mealPlan]);
    
    const macroTotals = useMemo(() => {
        return loggedEntries.reduce((acc, entry) => {
            acc.calories += entry.recipe.macros.calories;
            acc.protein += entry.recipe.macros.protein;
            acc.carbs += entry.recipe.macros.carbs;
            acc.fat += entry.recipe.macros.fat;
            return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }, [loggedEntries]);
    
    const totalDays = eatenLog.size;
    
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Consumption Log</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-sm text-blue-700 font-semibold">Total Meals Eaten</p>
                    <p className="text-3xl font-bold text-blue-900">{loggedEntries.length}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                    <p className="text-sm text-green-700 font-semibold">Avg. Daily Calories</p>
                    <p className="text-3xl font-bold text-green-900">{totalDays > 0 ? (macroTotals.calories / totalDays).toFixed(0) : 0}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg text-center">
                    <p className="text-sm text-yellow-700 font-semibold">Total Protein</p>
                    <p className="text-3xl font-bold text-yellow-900">{macroTotals.protein.toFixed(0)}g</p>
                </div>
                 <div className="p-4 bg-red-50 rounded-lg text-center">
                    <p className="text-sm text-red-700 font-semibold">Total Carbs</p>
                    <p className="text-3xl font-bold text-red-900">{macroTotals.carbs.toFixed(0)}g</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Meal</th>
                                <th scope="col" className="px-6 py-3">Recipe</th>
                                <th scope="col" className="px-6 py-3 text-right">Calories</th>
                                <th scope="col" className="px-6 py-3 text-right">Protein (g)</th>
                                <th scope="col" className="px-6 py-3 text-right">Carbs (g)</th>
                                <th scope="col" className="px-6 py-3 text-right">Fat (g)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loggedEntries.map((entry, index) => (
                                <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </th>
                                    <td className="px-6 py-4 capitalize">{entry.mealType}</td>
                                    <td className="px-6 py-4 font-semibold">{entry.recipe.name}</td>
                                    <td className="px-6 py-4 text-right">{entry.recipe.macros.calories.toFixed(0)}</td>
                                    <td className="px-6 py-4 text-right">{entry.recipe.macros.protein.toFixed(0)}</td>
                                    <td className="px-6 py-4 text-right">{entry.recipe.macros.carbs.toFixed(0)}</td>
                                    <td className="px-6 py-4 text-right">{entry.recipe.macros.fat.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 {loggedEntries.length === 0 && (
                    <div className="text-center p-8 text-gray-500">
                        No meals have been logged yet. Mark meals as "eaten" in the Planner view to see them here.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogView;
