import React, { useState, useMemo, useEffect } from 'react';
import { MealPlan, EatenLog, PlannedMeal, Recipe, MealType, Tab, RecipeCategory, Settings, DaySettings } from '../types';
import { LoadingIcon, GenerateIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, MagicWandIcon, XIcon, TrashIcon, PlusIcon, StarIcon, HeartIcon } from './Icons';
import PrepModePortal from './PrepModePortal';

interface PlannerViewProps {
  mealPlan: MealPlan;
  eatenLog: EatenLog;
  recipes: Recipe[];
  settings: Settings;
  generatePlan: (startDate: string, durationWeeks: number, dinnersPerWeek: number, breakfastsPerWeek: number, snacksPerWeek: number, drinkId?: string, drinkQty?: number) => void;
  isLoading: boolean;
  generationProgress: number;
  generationStatus: string;
  onMarkAsEaten: (date: string, mealType: MealType, eaten: boolean) => void;
  onRemovePlannedMeal: (date: string, mealType: MealType) => void;
  onSwapPlannedMeal: (date: string, mealType: MealType) => void;
  onAddPlannedMeal: (date: string, mealType: MealType) => void;
  setActiveTab: (tab: Tab) => void;
  onViewRecipe: (recipe: Recipe, portions?: number[]) => void;
  hasShoppingItems: boolean;
  generationPrerequisites: { canGenerate: boolean; missingMessage: string };
  defaultUniqueSettings: { dinners: number, breakfasts: number, snacks: number };
}

const GenerationProgressIndicator: React.FC<{ percentage: number; status: string }> = ({ percentage, status }) => {
    return (
        <div className="w-full space-y-4">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse min-h-[1.5em]">
                    {status || 'Preparing...'}
                </span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{Math.round(percentage)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 shadow-inner overflow-hidden">
                <div 
                    className="h-full bg-blue-600 transition-all duration-500 ease-out" 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const DailyMacrosModal: React.FC<{ date: string; plannedMeal: PlannedMeal; settings: Settings; onClose: () => void }> = ({ date, plannedMeal, settings, onClose }) => {
    const calculateTotalsPerPerson = (personIdx: number) => {
        const t = { calories: 0, protein: 0, carbs: 0, fat: 0, breakdown: [] as { name: string, type: string, kcal: number }[] };
        (['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).forEach(type => {
            const r = plannedMeal[type as keyof PlannedMeal] as Recipe;
            const portions = (plannedMeal as any)[`${type}Portions`] as number[] | undefined;
            const mult = portions ? portions[personIdx] : 1;
            if (r && r.macros) {
                const kcal = Math.round((r.macros.calories || 0) * mult);
                t.calories += kcal;
                t.protein += (r.macros.protein || 0) * mult;
                t.carbs += (r.macros.carbs || 0) * mult;
                t.fat += (r.macros.fat || 0) * mult;
                t.breakdown.push({ name: r.name, type, kcal });
            }
        });
        if (plannedMeal.drink && plannedMeal.drink.macros) {
            const qty = plannedMeal.drinkQuantity || 1;
            const kcal = Math.round((plannedMeal.drink.macros.calories || 0) * qty);
            t.calories += kcal;
            t.protein += (plannedMeal.drink.macros.protein || 0) * qty;
            t.carbs += (plannedMeal.drink.macros.carbs || 0) * qty;
            t.fat += (plannedMeal.drink.macros.fat || 0) * qty;
            t.breakdown.push({ name: plannedMeal.drink.name, type: 'drink', kcal });
        }
        return t;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-gray-100 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">Macro Breakdown</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"><XIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-grow">
                    {settings.people.map((person, idx) => {
                        const perPersonTotals = calculateTotalsPerPerson(idx);
                        const remainingFudge = Math.round(person.goals.calories - perPersonTotals.calories);
                        return (
                            <div key={idx} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-lg font-black text-gray-800">{person.name}</h4>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Daily Goal</p>
                                        <p className="text-xs font-bold text-blue-600">{person.goals.calories} kcal</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3 text-center mb-4">
                                    {[
                                        {l: 'Planned', v: Math.round(perPersonTotals.calories), i: 'text-gray-900'},
                                        {l: 'Protein', v: Math.round(perPersonTotals.protein) + 'g', i: 'text-blue-600'},
                                        {l: 'Carbs', v: Math.round(perPersonTotals.carbs) + 'g', i: 'text-green-600'},
                                        {l: 'Fat', v: Math.round(perPersonTotals.fat) + 'g', i: 'text-orange-600'}
                                    ].map(m => (
                                        <div key={m.l} className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">{m.l}</p>
                                            <p className={`text-xs font-black ${m.i}`}>{m.v}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1 bg-white p-3 rounded-xl border border-gray-200 shadow-inner">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b pb-1">Sources</p>
                                    {perPersonTotals.breakdown.map((item, iIdx) => (
                                        <div key={iIdx} className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-600 font-bold truncate max-w-[70%]">{item.name} <span className="text-[8px] text-gray-400 ml-1">({item.type})</span></span>
                                            <span className="text-gray-800 font-black">{item.kcal} kcal</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <HeartIcon className="w-4 h-4 text-pink-500" />
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Fudge Room Remaining</span>
                                    </div>
                                    <span className={`text-sm font-black ${remainingFudge > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {remainingFudge} kcal
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-6 bg-gray-50 border-t flex justify-center shrink-0">
                    <button onClick={onClose} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Close</button>
                </div>
            </div>
        </div>
    );
};

const PlanSuccessModal: React.FC<{ mealPlan: MealPlan; onClose: () => void; onGoToShopping: () => void }> = ({ mealPlan, onClose, onGoToShopping }) => {
    const summary = useMemo(() => {
        const uniqueRecipes = new Map<string, { recipe: Recipe; count: number }>();
        mealPlan.forEach((day) => {
            ['breakfast', 'lunch', 'snack', 'dinner'].forEach((type) => {
                const r = day[type as keyof PlannedMeal] as Recipe;
                if (r && r.category !== RecipeCategory.Drink) {
                    const existing = uniqueRecipes.get(r.id) || { recipe: r, count: 0 };
                    uniqueRecipes.set(r.id, { ...existing, count: existing.count + 1 });
                }
            });
        });

        const byCategory = {
            Dinners: [] as { recipe: Recipe; count: number }[],
            Breakfasts: [] as { recipe: Recipe; count: number }[],
            Snacks: [] as { recipe: Recipe; count: number }[],
        };

        uniqueRecipes.forEach((val) => {
            if (val.recipe.category === RecipeCategory.Dinner) byCategory.Dinners.push(val);
            else if (val.recipe.category === RecipeCategory.Breakfast || val.recipe.isAlsoBreakfast) byCategory.Breakfasts.push(val);
            else if (val.recipe.category === RecipeCategory.Snack || val.recipe.isAlsoSnack) byCategory.Snacks.push(val);
        });

        return byCategory;
    }, [mealPlan]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-gray-100 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 bg-green-50/50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight">Your Meal Plan is Ready! 🎉</h3>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-widest mt-1">Diversified & Balanced</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors shrink-0"><XIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="p-6 space-y-8 overflow-y-auto flex-grow">
                    {(Object.entries(summary) as [string, { recipe: Recipe; count: number }[]][]).map(([title, recipes]) => recipes.length > 0 && (
                        <div key={title}>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 border-b pb-1">{title} Chosen</h4>
                            <div className="space-y-2">
                                {recipes.map(({ recipe, count }) => (
                                    <div key={recipe.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex-grow pr-4">
                                            <p className="text-sm font-black text-gray-800 line-clamp-1">{recipe.name}</p>
                                        </div>
                                        <div className="shrink-0 bg-white px-3 py-1 rounded-lg border border-gray-200 text-center min-w-[70px]">
                                            <p className="text-[10px] font-black text-blue-600 leading-none">{count}</p>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Meals</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t bg-gray-50 shrink-0">
                    <button 
                        onClick={onGoToShopping}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                    >
                        <ShoppingCartIcon className="w-5 h-5" />
                        VIEW SHOPPING LIST
                    </button>
                </div>
            </div>
        </div>
    );
};

const SummaryModal: React.FC<{ recipe: Recipe; type: MealType; dayPlan: PlannedMeal; settings: Settings; onClose: () => void; onGoToKitchen: (portions?: number[]) => void }> = ({ recipe, type, dayPlan, settings, onClose, onGoToKitchen }) => {
    const portions = (dayPlan as any)[`${type}Portions`] as number[] | undefined;
    const macros = recipe.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-80 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-gray-100">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-black text-gray-800 tracking-tight leading-tight pr-4">{recipe.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors shrink-0"><XIcon className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-6">
                    {recipe.description && (
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Brief Description</p>
                            <p className="text-sm text-gray-600 leading-relaxed font-medium">{recipe.description}</p>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adjusted Portions & Macros</p>
                        <div className="space-y-2">
                            {settings.people.map((person, idx) => {
                                const p = portions ? portions[idx] : 1;
                                return (
                                    <div key={idx} className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-black text-blue-800">{person.name}</span>
                                            <span className="text-xs font-bold text-blue-600">{p.toFixed(2)} units</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            {[
                                                {l: 'Kcal', v: Math.round((macros.calories || 0) * p)},
                                                {l: 'P', v: Math.round((macros.protein || 0) * p) + 'g'},
                                                {l: 'C', v: Math.round((macros.carbs || 0) * p) + 'g'},
                                                {l: 'F', v: Math.round((macros.fat || 0) * p) + 'g'}
                                            ].map(m => (
                                                <div key={m.l} className="bg-white/60 p-1.5 rounded-lg border border-blue-100/50">
                                                    <p className="text-[8px] font-black text-blue-400 uppercase leading-none mb-1">{m.l}</p>
                                                    <p className="text-[11px] font-black text-blue-800">{m.v}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => onGoToKitchen(portions)}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black tracking-wide shadow-xl hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-2 group"
                    >
                        <MagicWandIcon className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform"/>
                        OPEN KITCHEN MODE
                    </button>
                </div>
            </div>
        </div>
    );
}

const PlannerView: React.FC<PlannerViewProps> = ({ 
    mealPlan, eatenLog, recipes, generatePlan, isLoading, 
    generationProgress, generationStatus,
    onMarkAsEaten, 
    onRemovePlannedMeal, onSwapPlannedMeal, onAddPlannedMeal,
    setActiveTab, onViewRecipe, hasShoppingItems, generationPrerequisites,
    defaultUniqueSettings, settings
}) => {
  const [view, setView] = useState<'month' | 'week' | 'today'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const [showSuccessSummary, setShowSuccessSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{ recipe: Recipe; type: MealType; plan: PlannedMeal } | null>(null);
  const [macroPopupData, setMacroPopupData] = useState<{ date: string; plan: PlannedMeal } | null>(null);
  const [showPrepPortal, setShowPrepPortal] = useState(false);

  const drinkOptions = useMemo(() => recipes.filter(r => r.category === RecipeCategory.Drink), [recipes]);
  const defaultDrink = useMemo(() => drinkOptions.find(d => d.isDefaultDrink) || drinkOptions[0], [drinkOptions]);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>(defaultDrink?.id || '');
  const [drinksPerPerson, setDrinksPerPerson] = useState(settings.defaultDrinksPerPersonPerDay || 2);

  const MEAL_ORDER: MealType[] = ['breakfast', 'snack', 'dinner', 'lunch'];

  const totalSlotsPerWeek = useMemo(() => {
      const counts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
      Object.values(settings.dailyMeals).forEach((day: any) => {
          if (day.breakfast) counts.breakfast++;
          if (day.lunch) counts.lunch++;
          if (day.dinner) counts.dinner++;
          if (day.snack) counts.snack++;
      });
      return counts;
  }, [settings.dailyMeals]);

  const handlePrev = () => {
    setCurrentDate(d => {
        const newDate = new Date(d);
        if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
        else newDate.setDate(newDate.getDate() - 1);
        return newDate;
    });
  };

  const handleNext = () => {
    setCurrentDate(d => {
        const newDate = new Date(d);
        if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
        else newDate.setDate(newDate.getDate() + 1);
        return newDate;
    });
  };

  const getHeaderTitle = () => {
    if (view === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (view === 'week') {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const MealComponent: React.FC<{ recipe: Recipe, dateString: string, mealType: MealType, plan: PlannedMeal }> = ({ recipe, dateString, mealType, plan }) => {
    const isEaten = eatenLog.get(dateString)?.[mealType] ?? false;
    const mealTypeStyles: Record<MealType, { bg: string; text: string; label: string }> = {
        breakfast: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'B:' },
        lunch: { bg: 'bg-green-50', text: 'text-green-700', label: 'L:' },
        snack: { bg: 'bg-pink-50', text: 'text-pink-700', label: 'S:' },
        dinner: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'D:' },
        drink: { bg: 'bg-orange-50', text: 'text-orange-700', label: '☕' },
    };
    const { bg, text, label } = mealTypeStyles[mealType];

    return (
      <div className={`${bg} ${text} p-1 rounded border border-transparent group relative flex items-center transition-all hover:border-gray-200 shadow-sm`}>
        <div className="flex-grow truncate text-[11px] font-bold cursor-pointer" onClick={() => setSummaryData({ recipe, type: mealType, plan })}>
          <strong className="mr-1 opacity-60">{label}</strong>
          {recipe.name}
        </div>
        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onSwapPlannedMeal(dateString, mealType)} className="p-0.5 text-blue-600 hover:bg-blue-100 rounded" title="Swap"><MagicWandIcon className="w-3 h-3"/></button>
            <button onClick={() => onRemovePlannedMeal(dateString, mealType)} className="p-0.5 text-red-600 hover:bg-red-100 rounded" title="Remove"><TrashIcon className="w-3 h-3"/></button>
            <label className="flex items-center cursor-pointer ml-0.5">
                <input type="checkbox" checked={isEaten} onChange={(e) => onMarkAsEaten(dateString, mealType, e.target.checked)} className="hidden" />
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isEaten ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400'}`}>
                    {isEaten && <CheckIcon className="w-2 h-2 text-white" />}
                </div>
            </label>
        </div>
      </div>
    );
  };

  const DayCell: React.FC<{day: Date}> = ({day}) => {
    const dateString = day.toISOString().split('T')[0];
    const plannedDay = mealPlan.get(dateString);
    const isToday = day.toDateString() === new Date().toDateString();
    const isMealPrepDay = plannedDay?.isMealPrepDay;

    return (
        <div className={`p-2 bg-white flex flex-col relative overflow-y-auto border-r border-b group/cell ${view === 'week' ? 'h-64' : 'h-52'}`}>
          <div className="flex justify-between items-start mb-1">
              <span className={`font-bold text-xs ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow' : 'text-gray-500'}`}>{day.getDate()}</span>
              {isMealPrepDay && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded font-black uppercase shadow-sm">Prep Day</span>}
          </div>
          <div className="space-y-1 flex-grow">
            {isMealPrepDay && (
                <div className="flex flex-col gap-1 mt-1">
                    <button 
                        onClick={() => setActiveTab({id: 'shopping', label: 'Shopping List'})}
                        className="w-full py-2 bg-green-50 text-green-700 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 border border-green-100 hover:bg-green-100 transition-all shadow-sm"
                    >
                        <ShoppingCartIcon className="w-2.5 h-2.5" /> List
                    </button>
                    <button 
                        onClick={() => setShowPrepPortal(true)}
                        className="w-full py-2 bg-purple-50 text-purple-700 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 border border-purple-100 hover:bg-purple-100 transition-all shadow-sm"
                    >
                        <MagicWandIcon className="w-2.5 h-2.5" /> Prep
                    </button>
                </div>
            )}
            {!isMealPrepDay && plannedDay?.drink && (
                 <div className="bg-orange-50 text-orange-700 p-1 rounded border border-transparent flex items-center shadow-sm">
                    <span className="text-[10px] font-bold truncate">☕ {plannedDay.drinkQuantity}x {plannedDay.drink.name}</span>
                 </div>
            )}
            {!isMealPrepDay && MEAL_ORDER.map(type => (
                plannedDay?.[type as keyof PlannedMeal] 
                ? <MealComponent key={type} recipe={plannedDay[type as keyof PlannedMeal] as Recipe} dateString={dateString} mealType={type as MealType} plan={plannedDay as PlannedMeal} />
                : (plannedDay ? <button key={type} onClick={() => onAddPlannedMeal(dateString, type)} className="w-full py-0.5 border border-dashed border-gray-200 rounded text-[9px] text-gray-300 font-bold uppercase hover:bg-gray-50 transition-colors">+ {type}</button> : null)
            ))}
          </div>
          {plannedDay && !isMealPrepDay && (
              <button 
                onClick={() => setMacroPopupData({ date: dateString, plan: plannedDay })}
                className="mt-1 w-full bg-gray-50 hover:bg-blue-50 text-[8px] font-black text-gray-400 hover:text-blue-600 border border-gray-100 rounded transition-all py-1 uppercase tracking-tighter opacity-0 group-hover/cell:opacity-100"
              >
                  Macros
              </button>
          )}
        </div>
    )
  }

  const TodayView = () => {
    const dayStr = currentDate.toISOString().split('T')[0];
    const plannedDay = mealPlan.get(dayStr);
    const isTodayActual = currentDate.toDateString() === new Date().toDateString();
    
    return (
      <div className="space-y-4 max-w-3xl mx-auto py-4">
        <div className="flex justify-between items-center px-2">
            <h3 className="text-xl font-black text-gray-800 tracking-tight">
                {isTodayActual ? "Today" : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
        </div>

        {plannedDay?.isMealPrepDay && hasShoppingItems && (
            <div 
                onClick={() => setActiveTab({id: 'shopping', label: 'Shopping List'})}
                className="bg-green-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between cursor-pointer hover:bg-green-700 transition-all transform active:scale-95"
            >
                <div className="flex items-center gap-3">
                    <ShoppingCartIcon className="w-6 h-6" />
                    <div>
                        <p className="font-black text-sm uppercase tracking-wider">Plan Generated - Shopping List Ready</p>
                        <p className="text-xs opacity-80">Click to view your grocery list for the new cycle</p>
                    </div>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-lg font-bold text-sm">OPEN LIST</div>
            </div>
        )}

        {plannedDay?.isMealPrepDay && (
            <div className="flex flex-col gap-3">
                <div className="bg-purple-600 border border-purple-700 p-4 rounded-xl text-center font-bold text-white shadow-lg animate-pulse">
                    🍴 MEAL PREP DAY: Get your weekly batch cooking done today!
                </div>
                <button 
                    onClick={() => setShowPrepPortal(true)}
                    className="w-full py-4 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-black shadow hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                >
                    <MagicWandIcon className="w-5 h-5" />
                    START BATCH PREP MODE
                </button>
            </div>
        )}

        {plannedDay && !plannedDay.isMealPrepDay ? (
            <>
                {plannedDay.drink && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 flex items-start group transition-all hover:shadow-md">
                        <div className="w-24 shrink-0 text-center mr-4 border-r pr-4">
                            <p className="font-black text-[10px] text-orange-400 uppercase tracking-widest mb-1">Morning Drink</p>
                            <div className="text-xs font-black text-orange-600">{plannedDay.drinkQuantity} Units</div>
                        </div>
                        <div className="flex-grow">
                            <h3 className="font-black text-lg text-gray-800 leading-tight">{plannedDay.drink.name}</h3>
                            <p className="text-xs text-gray-500 mt-2">Energy: {Math.round((plannedDay.drink.macros?.calories || 0) * (plannedDay.drinkQuantity || 1))} kcal per person</p>
                        </div>
                    </div>
                )}

                {MEAL_ORDER.map(mealType => {
                const recipe = plannedDay[mealType as keyof PlannedMeal] as Recipe;
                const isEaten = eatenLog.get(dayStr)?.[mealType] ?? false;
                const mealTypeStyles: Record<MealType, { bg: string; text: string }> = {
                    breakfast: { bg: 'border-yellow-100', text: 'text-yellow-600' },
                    lunch: { bg: 'border-green-100', text: 'text-green-600' },
                    snack: { bg: 'border-pink-100', text: 'text-pink-600' },
                    dinner: { bg: 'border-indigo-100', text: 'text-indigo-600' },
                    drink: { bg: 'border-orange-100', text: 'text-orange-600' },
                };
                return (
                    <div key={mealType} className={`bg-white p-5 rounded-2xl shadow-sm border ${recipe ? mealTypeStyles[mealType as MealType].bg : 'border-gray-200'} flex items-start group transition-all hover:shadow-md ${recipe ? '' : 'opacity-60'}`}>
                    <div className="w-24 shrink-0 text-center mr-4 border-r pr-4">
                        <p className={`font-black text-[10px] uppercase tracking-widest mb-1 ${recipe ? mealTypeStyles[mealType as MealType].text : 'text-gray-400'}`}>{mealType}</p>
                    </div>
                    {recipe ? (
                        <>
                        <div className="flex-grow cursor-pointer" onClick={() => setSummaryData({ recipe, type: mealType as MealType, plan: plannedDay })}>
                            <h3 className="font-black text-lg text-gray-800 group-hover:text-blue-600 transition-colors leading-tight">{recipe.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TAP FOR PORTION BREAKDOWN</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                            <div className="flex items-center gap-1">
                                <button onClick={() => onSwapPlannedMeal(dayStr, mealType as MealType)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl" title="Swap Recipe"><MagicWandIcon className="w-5 h-5"/></button>
                                <button onClick={() => onRemovePlannedMeal(dayStr, mealType as MealType)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl" title="Remove"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                            <label className="flex items-center cursor-pointer bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 hover:border-green-300 transition-all">
                                <span className="text-[10px] font-black mr-2 text-gray-600 uppercase tracking-tighter">EATEN?</span>
                                <input type="checkbox" checked={isEaten} onChange={(e) => onMarkAsEaten(dayStr, mealType as MealType, e.target.checked)} className="hidden" />
                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isEaten ? 'bg-green-500 border-green-500 scale-110 shadow' : 'bg-white border-gray-300'}`}>
                                {isEaten && <CheckIcon className="w-3 h-3 text-white" />}
                                </div>
                            </label>
                        </div>
                        </>
                    ) : (
                        <div className="flex-grow flex items-center justify-between">
                            <span className="text-gray-400 italic font-medium">No {mealType} planned.</span>
                            <button onClick={() => onAddPlannedMeal(dayStr, mealType as MealType)} className="bg-blue-50 text-blue-600 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-blue-100 transition-all shadow-sm">ADD +</button>
                        </div>
                    )}
                    </div>
                )
                })}
            </>
        ) : !plannedDay ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nothing planned for {isTodayActual ? "today" : "this day"}.</p>
                <button onClick={() => setShowGenerateOptions(true)} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg">CREATE A NEW PLAN</button>
            </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-x-2 md:gap-x-4">
            <div className="flex items-center bg-gray-100 rounded-full p-1 shadow-inner">
                <button onClick={handlePrev} className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-600 transition-all"><ChevronLeftIcon className="w-4 h-4"/></button>
                <button onClick={handleNext} className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-600 transition-all"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
            <h2 className="text-lg md:text-2xl font-black text-gray-800 w-auto md:w-72 text-center tracking-tight">{getHeaderTitle()}</h2>
        </div>
        <div className="flex items-center gap-x-2 md:gap-x-4">
            <div className="bg-gray-100 p-1 rounded-xl flex text-[9px] font-black uppercase tracking-widest shadow-inner">
                {['month', 'week', 'today'].map(v => (
                    <button key={v} onClick={() => setView(v as any)} className={`px-3 py-1.5 rounded-lg ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'} transition-all`}>{v}</button>
                ))}
            </div>
             <button
                onClick={() => !generationPrerequisites.canGenerate ? alert(generationPrerequisites.missingMessage) : setShowGenerateOptions(true)}
                disabled={isLoading}
                className={`flex items-center px-4 py-2 rounded-xl shadow-lg transition-all transform active:scale-95 ${
                    !generationPrerequisites.canGenerate 
                    ? 'bg-gray-400 text-white opacity-90 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                >
                {isLoading ? <LoadingIcon className="w-4 h-4" /> : <GenerateIcon className="w-4 h-4" />}
                <span className="ml-2 text-xs font-black hidden md:inline tracking-wide">{isLoading ? 'Generating...' : 'Generate Plan'}</span>
            </button>
        </div>
      </div>
      
      {isLoading && (
          <div className="absolute inset-x-0 top-20 flex justify-center z-50 px-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-blue-100 max-w-sm w-full animate-fade-in text-center space-y-6">
                  <LoadingIcon className="w-12 h-12 text-blue-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">AI Chef is working...</h3>
                    <p className="text-xs font-medium text-gray-500 mt-2">Optimizing meal sequence for your library.</p>
                  </div>
                  <GenerationProgressIndicator percentage={generationProgress} status={generationStatus} />
              </div>
          </div>
      )}

      {view !== 'today' && (
        <div className="bg-gray-200 border border-gray-200 rounded-2xl overflow-hidden shadow-inner grid grid-cols-7 gap-px relative">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center font-black py-3 bg-gray-100 text-gray-400 text-[10px] uppercase tracking-[0.1em] border-b border-gray-200">{day}</div>)}
            {view === 'month' && Array(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()).fill(null).map((_, i) => <div key={i} className="bg-gray-50 h-52 opacity-50"></div>)}
            {(view === 'month' ? Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)) : Array.from({length: 7}, (_, i) => { const d = new Date(currentDate); d.setDate(d.getDate() - d.getDay() + i); return d; })).map(day => <DayCell key={day.toISOString()} day={day} />)}
            {isLoading && <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10"></div>}
        </div>
      )}

      {view === 'today' && <TodayView />}
      
      {summaryData && (
        <SummaryModal 
            recipe={summaryData.recipe} 
            type={summaryData.type}
            dayPlan={summaryData.plan}
            settings={settings}
            onClose={() => setSummaryData(null)} 
            onGoToKitchen={(portions) => { onViewRecipe(summaryData.recipe, portions); setSummaryData(null); }} 
        />
      )}

      {macroPopupData && (
          <DailyMacrosModal 
            date={macroPopupData.date} 
            plannedMeal={macroPopupData.plan} 
            settings={settings} 
            onClose={() => setMacroPopupData(null)} 
          />
      )}

      {showPrepPortal && (
          <PrepModePortal 
            mealPlan={mealPlan} 
            settings={settings} 
            onClose={() => setShowPrepPortal(false)} 
          />
      )}

      {showSuccessSummary && mealPlan.size > 0 && (
          <PlanSuccessModal 
            mealPlan={mealPlan} 
            onClose={() => setShowSuccessSummary(false)} 
            onGoToShopping={() => { setActiveTab({id: 'shopping', label: 'Shopping List'}); setShowSuccessSummary(false); }}
          />
      )}

      {showGenerateOptions && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-90 p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-fade-in border border-gray-200">
                  <div className="flex justify-between items-center mb-5">
                      <h3 className="text-xl font-black text-gray-800 tracking-tight">Plan Options</h3>
                      <button onClick={() => setShowGenerateOptions(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-all"><XIcon className="w-5 h-5"/></button>
                  </div>
                  <div className="space-y-5">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Plan Start Date</label>
                          <input 
                            type="date" 
                            defaultValue={(() => {
                                const nextMon = new Date();
                                nextMon.setDate(nextMon.getDate() + (1 + 7 - nextMon.getDay()) % 7);
                                return nextMon.toISOString().split('T')[0];
                            })()} 
                            id="start-date-input"
                            className="w-full bg-transparent border-none p-0 font-black text-lg text-gray-800 focus:ring-0" 
                          />
                      </div>
                      
                      <div className="space-y-3 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                          <label className="block text-[10px] font-black text-orange-400 uppercase tracking-widest leading-tight">Morning Drink (Per Person)</label>
                          <select 
                            value={selectedDrinkId} 
                            onChange={e => setSelectedDrinkId(e.target.value)}
                            className="w-full bg-white border-orange-200 rounded-lg text-sm font-bold text-gray-700"
                          >
                            {drinkOptions.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({(d.macros?.calories || 0)} kcal)</option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between">
                             <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Qty/Person</span>
                             <div className="flex items-center bg-white rounded-lg border border-orange-200 p-1">
                                <button onClick={() => setDrinksPerPerson(Math.max(1, drinksPerPerson - 1))} className="px-2 text-orange-600 font-black">-</button>
                                <span className="px-3 text-sm font-black text-gray-800">{drinksPerPerson}</span>
                                <button onClick={() => setDrinksPerPerson(drinksPerPerson + 1)} className="px-2 text-orange-600 font-black">+</button>
                             </div>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Targets per person (Total Slots)</label>
                          <div className="grid grid-cols-1 gap-2">
                              {[
                                {label: 'Dinners', val: totalSlotsPerWeek.dinner, c: 'text-blue-600', b: 'bg-blue-50'},
                                {label: 'Lunches', val: totalSlotsPerWeek.lunch, c: 'text-green-600', b: 'bg-green-50'},
                                {label: 'Breakfasts', val: totalSlotsPerWeek.breakfast, c: 'text-yellow-600', b: 'bg-yellow-50'},
                                {label: 'Snacks', val: totalSlotsPerWeek.snack, c: 'text-pink-600', b: 'bg-pink-50'}
                              ].map(s => (
                                  <div key={s.label} className={`flex justify-between items-center ${s.b} px-4 py-3 rounded-xl border border-gray-100`}>
                                      <span className={`text-[11px] font-black uppercase ${s.c}`}>Total {s.label} Slots</span>
                                      <span className="text-base font-black text-gray-800">{s.val}</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <button
                        onClick={() => { 
                            const input = document.getElementById('start-date-input') as HTMLInputElement;
                            setShowGenerateOptions(false); 
                            generatePlan(
                                input.value, 
                                settings.planDurationWeeks, 
                                defaultUniqueSettings.dinners, 
                                defaultUniqueSettings.breakfasts, 
                                defaultUniqueSettings.snacks,
                                selectedDrinkId,
                                drinksPerPerson
                            );
                        }}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                      >
                          <GenerateIcon className="h-5 w-5" />
                          GENERATE PLAN
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlannerView;