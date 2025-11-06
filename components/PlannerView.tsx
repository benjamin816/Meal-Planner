
import React, { useState } from 'react';
import { MealPlan, EatenLog, PlannedMeal, Recipe, MealType, Tab } from '../types';
import { LoadingIcon, GenerateIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon } from './Icons';
import Tag from './Tag';


interface PlannerViewProps {
  mealPlan: MealPlan;
  eatenLog: EatenLog;
  generatePlan: () => void;
  isLoading: boolean;
  onDayClick: (date: string, meal: PlannedMeal) => void;
  onMarkAsEaten: (date: string, mealType: MealType, eaten: boolean) => void;
  setActiveTab: (tab: Tab) => void;
}

const PlannerView: React.FC<PlannerViewProps> = ({ mealPlan, eatenLog, generatePlan, isLoading, onDayClick, onMarkAsEaten, setActiveTab }) => {
  const [view, setView] = useState<'month' | 'week' | 'today'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrev = () => {
    setCurrentDate(d => {
        const newDate = new Date(d);
        if (view === 'month') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else if (view === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        return newDate;
    });
  };

  const handleNext = () => {
    setCurrentDate(d => {
        const newDate = new Date(d);
        if (view === 'month') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (view === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        return newDate;
    });
  };

  const daysForWeekView = (() => {
    const week: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        week.push(day);
    }
    return week;
  })();

  const getHeaderTitle = () => {
    if (view === 'month') {
        return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
        const startOfWeek = daysForWeekView[0];
        const endOfWeek = daysForWeekView[6];
        const startMonth = startOfWeek.toLocaleString('default', { month: 'short' });
        const endMonth = endOfWeek.toLocaleString('default', { month: 'short' });

        if (startMonth === endMonth) {
            return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
        } else {
            return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
        }
    } else {
        return currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  };


  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDayOfMonth = startOfMonth.getDay();

  const daysInMonth: Date[] = [];
  for (let i = 1; i <= endOfMonth.getDate(); i++) {
    daysInMonth.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const blanksForMonthView = Array(startDayOfMonth).fill(null);
  const weekDayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const MealComponent = ({ recipe, dateString, mealType }: { recipe: Recipe, dateString: string, mealType: MealType }) => {
    const isEaten = eatenLog.get(dateString)?.[mealType] ?? false;
    
    const mealTypeStyles: Record<MealType, { bg: string; text: string; label: string }> = {
        breakfast: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'B:' },
        lunch: { bg: 'bg-green-100', text: 'text-green-800', label: 'L:' },
        dinner: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'D:' },
        snack: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'S:' },
    };

    const { bg, text, label } = mealTypeStyles[mealType];

    return (
      <div className={`${bg} ${text} p-1 rounded mb-1 flex items-center group`}>
        <div className="flex-grow truncate text-xs">
          <strong className="mr-1">{label}</strong>
          {recipe.name}
        </div>
        <label className="flex items-center cursor-pointer ml-1">
          <input 
            type="checkbox" 
            checked={isEaten}
            onChange={(e) => onMarkAsEaten(dateString, mealType, e.target.checked)}
            className="hidden"
          />
          <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isEaten ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400 group-hover:border-gray-600'}`}>
            {isEaten && <CheckIcon />}
          </div>
        </label>
      </div>
    );
  };
  
  const DayCell: React.FC<{day: Date}> = ({day}) => {
    const dateString = day.toISOString().split('T')[0];
    const plannedDay = mealPlan.get(dateString);
    const isToday = day.toDateString() === new Date().toDateString();
    const hasMeals = plannedDay?.breakfast || plannedDay?.lunch || plannedDay?.dinner || plannedDay?.snack;
    
    const isThursday = day.getDay() === 4;
    let isShoppingDay = false;
    if (isThursday) {
        // A plan generated on a Sunday for the next 7 days will have entries for Sun, Mon, Tue...
        // So we check if the *next* Sunday has a plan.
        const nextSunday = new Date(day);
        nextSunday.setDate(day.getDate() + 3);
        const sundayDateString = nextSunday.toISOString().split('T')[0];
        if (mealPlan.has(sundayDateString)) {
            isShoppingDay = true;
        }
    }

    return (
        <div 
          className={`p-2 bg-white flex flex-col relative overflow-y-auto ${hasMeals ? 'cursor-pointer hover:bg-gray-50' : ''} ${view === 'week' ? 'h-64' : 'h-32'}`}
          onClick={() => hasMeals && onDayClick(dateString, plannedDay!)}
        >
          <span className={`font-semibold text-sm ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'}`}>
            {day.getDate()}
          </span>
           {isShoppingDay && (
              <div 
                  onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab({id: 'shopping', label: 'Shopping List'});
                  }}
                  className="mt-1 bg-green-100 text-green-800 p-1 rounded text-xs flex items-center justify-center cursor-pointer hover:bg-green-200"
              >
                  <ShoppingCartIcon />
                  <span className="ml-1 font-semibold">Shopping</span>
              </div>
          )}
          <div className="mt-1 space-y-1">
            {plannedDay?.breakfast && (
              <MealComponent recipe={plannedDay.breakfast} dateString={dateString} mealType="breakfast" />
            )}
             {plannedDay?.lunch && (
              <MealComponent recipe={plannedDay.lunch} dateString={dateString} mealType="lunch" />
            )}
            {plannedDay?.dinner && (
              <MealComponent recipe={plannedDay.dinner} dateString={dateString} mealType="dinner" />
            )}
             {plannedDay?.snack && (
              <MealComponent recipe={plannedDay.snack} dateString={dateString} mealType="snack" />
            )}
          </div>
        </div>
    )
  }

  const TodayView = () => {
    const dateString = currentDate.toISOString().split('T')[0];
    const plannedDay = mealPlan.get(dateString);
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  
    return (
      <div className="space-y-4 max-w-3xl mx-auto py-4">
        {mealTypes.map(mealType => {
          const recipe = plannedDay?.[mealType];
          const isEaten = eatenLog.get(dateString)?.[mealType] ?? false;
          
          return (
            <div 
              key={mealType} 
              className={`bg-white p-4 rounded-lg shadow-md flex items-start group ${recipe ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60'}`} 
              onClick={() => recipe && onDayClick(dateString, plannedDay!)}
            >
              <div className="w-24 shrink-0 text-center mr-4">
                <p className="font-bold text-blue-600 capitalize">{mealType}</p>
              </div>
              {recipe ? (
                <>
                  <div className="flex-grow">
                    <h3 className="font-bold text-lg text-gray-800">{recipe.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.slice(0, 3).map(tag => <Tag key={tag} tag={tag} />)}
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0 flex flex-col items-end">
                     <p className="text-lg font-semibold text-gray-700">{recipe.macros.calories.toFixed(0)} <span className="text-xs text-gray-500 font-normal">kcal</span></p>
                     <label className="flex items-center justify-end cursor-pointer mt-2">
                        <span className="text-xs mr-2 text-gray-500 group-hover:text-gray-800 transition-colors">Eaten</span>
                        <input 
                          type="checkbox" 
                          checked={isEaten} 
                          onChange={(e) => {
                            e.stopPropagation();
                            onMarkAsEaten(dateString, mealType, e.target.checked);
                          }} 
                          className="hidden" 
                        />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isEaten ? 'bg-green-500 border-green-500' : 'bg-white border-gray-400 group-hover:border-gray-600'}`}>
                          {isEaten && <CheckIcon />}
                        </div>
                      </label>
                  </div>
                </>
              ) : (
                <div className="flex-grow text-gray-400 italic self-center">No {mealType} planned.</div>
              )}
            </div>
          )
        })}
      </div>
    );
  };


  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-x-2 md:gap-x-4">
            <div className="flex items-center">
                <button onClick={handlePrev} className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"><ChevronLeftIcon /></button>
                <button onClick={handleNext} className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"><ChevronRightIcon /></button>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-700 w-64 text-center">{getHeaderTitle()}</h2>
        </div>

        <div className="flex items-center gap-x-2 md:gap-x-4">
            <div className="bg-gray-100 p-1 rounded-lg flex text-sm">
                <button onClick={() => setView('month')} className={`px-3 py-1 rounded-md ${view === 'month' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-200'} transition-all`}>Month</button>
                <button onClick={() => setView('week')} className={`px-3 py-1 rounded-md ${view === 'week' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-200'} transition-all`}>Week</button>
                <button onClick={() => setView('today')} className={`px-3 py-1 rounded-md ${view === 'today' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-200'} transition-all`}>Today</button>
            </div>
             <button
                onClick={generatePlan}
                disabled={isLoading}
                className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                {isLoading ? <LoadingIcon /> : <GenerateIcon />}
                <span className="ml-2 text-sm hidden md:inline">{isLoading ? 'Generating...' : 'Generate Plan'}</span>
            </button>
        </div>
      </div>
      
      {view !== 'today' && (
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {weekDayHeaders.map(day => (
            <div key={day} className="text-center font-semibold py-2 bg-gray-100 text-gray-600 text-sm">{day}</div>
            ))}

            {view === 'month' && blanksForMonthView.map((_, index) => <div key={`blank-${index}`} className="bg-gray-50 h-32"></div>)}
            
            {view === 'month' && daysInMonth.map(day => <DayCell key={day.toISOString()} day={day} />)}

            {view === 'week' && daysForWeekView.map(day => <DayCell key={day.toISOString()} day={day} />)}
        </div>
      )}

      {view === 'today' && <TodayView />}
    </div>
  );
};

export default PlannerView;
