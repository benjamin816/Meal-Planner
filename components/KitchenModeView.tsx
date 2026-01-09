
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Recipe, Settings } from '../types';
import { XIcon, CheckIcon } from './Icons';

// --- Helper Functions ---
const cleanListString = (text: string = ''): string[] => {
    if (!text) return [];
    const cleanedText = text.replace(/^- \[ ?\] /gm, '').trim();
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);
    
    if (lines.length === 1 && lines[0].length > 100) {
        const potentialList = lines[0].split(/(?=\s*-\s|\s*\*\s|\s*\d+\.\s)/g);
        if (potentialList.length > 1) {
            return potentialList.map(item => item.trim().replace(/^(-|\*|\d+\.)\s*/, '')).filter(Boolean);
        }
    }
    return lines;
};

const playTimerSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
};

// --- Timer Component ---
interface TimerProps {
    durationInSeconds: number;
}

const Timer: React.FC<TimerProps> = ({ durationInSeconds }) => {
    const [remaining, setRemaining] = useState(durationInSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const intervalId = useRef<number | null>(null);

    useEffect(() => {
        if (isRunning && remaining > 0) {
            intervalId.current = window.setInterval(() => {
                setRemaining(r => r - 1);
            }, 1000);
        } else if (remaining <= 0 && isRunning) {
            if (intervalId.current) clearInterval(intervalId.current);
            setIsRunning(false);
            playTimerSound();
        }
        return () => {
            if (intervalId.current) clearInterval(intervalId.current);
        };
    }, [isRunning, remaining]);

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return "Done!";
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
    
    const originalText = useMemo(() => {
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`;
        return `${minutes} min`;
    }, [durationInSeconds]);

    const handleClick = () => {
        if (isRunning) {
            setIsRunning(false);
            if (intervalId.current) clearInterval(intervalId.current);
        } else {
             if (remaining <= 0) {
                setRemaining(durationInSeconds);
             }
            setIsRunning(true);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`inline-block font-semibold px-2 py-1 rounded-md text-sm mx-1 transition-colors ${
                isRunning ? 'bg-orange-500 text-white' : (remaining <= 0 ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200')
            }`}
        >
            {isRunning || remaining <= 0 ? formatTime(remaining) : `▶ Start Timer (${originalText})`}
        </button>
    );
};

// --- Main View ---
interface KitchenModeViewProps {
  recipe: Recipe;
  portions?: number[];
  settings: Settings;
  onClose: () => void;
}

const KitchenModeView: React.FC<KitchenModeViewProps> = ({ recipe, portions, settings, onClose }) => {
  const [viewIndex, setViewIndex] = useState<number | 'all'>('all');
  
  const currentPortionCount = useMemo(() => {
      if (viewIndex === 'all') {
          return portions ? portions.reduce((a, b) => a + b, 0) : 1;
      }
      return portions ? portions[viewIndex] : 1;
  }, [viewIndex, portions]);

  const ingredientsList = useMemo(() => {
      const baseLines = cleanListString(recipe.ingredients);
      if (currentPortionCount === 1) return baseLines;
      
      // Smart scaling logic for text
      return baseLines.map(line => {
          return line.replace(/(\d+(\.\d+)?)/g, (match) => {
              const num = parseFloat(match);
              if (isNaN(num)) return match;
              return (num * currentPortionCount).toFixed(2).replace(/\.00$/, '');
          });
      });
  }, [recipe.ingredients, currentPortionCount]);

  const instructionsList = useMemo(() => cleanListString(recipe.instructions), [recipe.instructions]);

  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
  
  useEffect(() => {
    setCompletedSteps(Array(instructionsList.length).fill(false));
  }, [instructionsList]);

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = !newSteps[index];
      return newSteps;
    });
  };

  const renderInstructionText = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    const regex = /(\d+)\s*(minutes|minute|min|hours|hour|hr|seconds|second|sec)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      parts.push(text.slice(lastIndex, match.index));
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      let seconds = 0;
      if (unit.startsWith('h')) seconds = value * 3600;
      else if (unit.startsWith('m')) seconds = value * 60;
      else seconds = value;
      parts.push(<Timer key={match.index} durationInSeconds={seconds} />);
      lastIndex = regex.lastIndex;
    }

    parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <div className="fixed inset-0 bg-white z-[90] p-4 sm:p-6 lg:p-8 flex flex-col overflow-hidden">
      <div className="flex justify-between items-start mb-4 shrink-0 border-b pb-4">
        <div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight">{recipe.name}</h1>
            <div className="flex items-center gap-2 mt-2">
                <span className="bg-blue-100 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                    {currentPortionCount.toFixed(2)} Servings Total
                </span>
                <span className="bg-purple-100 text-purple-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">{recipe.category}</span>
            </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-all">
          <XIcon className="w-8 h-8" />
        </button>
      </div>

      {/* View Selector */}
      {portions && portions.length > 1 && (
          <div className="flex gap-2 mb-6 shrink-0 bg-gray-100 p-1.5 rounded-2xl w-fit">
              <button 
                onClick={() => setViewIndex('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewIndex === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  All View
              </button>
              {settings.people.map((p, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setViewIndex(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewIndex === idx ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                      {p.name}'s View
                  </button>
              ))}
          </div>
      )}

      <div className="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Ingredients Column */}
        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner overflow-y-auto">
          <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-widest border-b pb-3 flex justify-between">
              Ingredients
              <span className="text-xs text-gray-400 font-bold lowercase tracking-tight">(Scaled for {viewIndex === 'all' ? 'Household' : settings.people[viewIndex as number].name})</span>
          </h2>
          <ul className="space-y-4">
            {ingredientsList.map((ingredient, index) => (
              <li key={index} className="flex items-start bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-blue-500 font-black mr-3 shrink-0">•</span>
                  <span className="text-base text-gray-700 font-medium leading-tight">{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions Column */}
        <div className="p-6 overflow-y-auto">
          <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-widest border-b pb-3">Cooking Instructions</h2>
          <ol className="space-y-8">
            {instructionsList.map((instruction, index) => (
              <li key={index} className="flex items-start group">
                 <div 
                    onClick={() => toggleStep(index)}
                    className={`cursor-pointer shrink-0 mt-0.5 mr-5 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg transition-all shadow-md transform active:scale-90 ${completedSteps[index] ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-400 border border-gray-200 group-hover:border-blue-400 group-hover:text-blue-500'}`}
                >
                    {completedSteps[index] ? <CheckIcon className="w-6 h-6"/> : (index + 1)}
                </div>
                <div className="flex-grow">
                    <p className={`text-lg leading-relaxed text-gray-700 font-medium transition-all ${completedSteps[index] ? 'line-through opacity-40' : ''}`}>
                        {renderInstructionText(instruction)}
                    </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default KitchenModeView;
