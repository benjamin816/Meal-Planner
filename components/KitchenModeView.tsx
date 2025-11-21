
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Recipe, Settings, BulkParsedRecipe } from '../types';
import { XIcon, CheckIcon, LoadingIcon } from './Icons';
import { editRecipeWithGemini } from '../services/geminiService';

// --- Helper Functions ---
const cleanListString = (text: string = ''): string[] => {
    if (!text) return [];
    // remove markdown checkboxes like '- [ ] ' or '- [] '
    const cleanedText = text.replace(/^- \[ ?\] /gm, '').trim();
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Fallback for run-on sentences
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
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A6
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
  onClose: () => void;
  settings: Settings;
  onAdjustServings: (recipe: Recipe, newServings: number) => Promise<BulkParsedRecipe | null>;
}

const KitchenModeView: React.FC<KitchenModeViewProps> = ({ recipe, onClose, settings, onAdjustServings }) => {
  const [displayedRecipe, setDisplayedRecipe] = useState<Recipe | BulkParsedRecipe>(recipe);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const ingredientsList = useMemo(() => cleanListString(displayedRecipe.ingredients), [displayedRecipe.ingredients]);
  const instructionsList = useMemo(() => cleanListString(displayedRecipe.instructions), [displayedRecipe.instructions]);

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

  const targetServings = settings.numberOfPeople * settings.servingsPerPerson;
  const needsAdjustment = displayedRecipe.servings !== targetServings;

  const handleAdjust = async () => {
      setIsAdjusting(true);
      const adjusted = await onAdjustServings(recipe, targetServings);
      if (adjusted) {
          setDisplayedRecipe(adjusted);
      } else {
          alert("Sorry, the AI could not adjust the servings for this recipe.");
      }
      setIsAdjusting(false);
  };


  const renderInstructionText = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    // Regex to find numbers followed by time units
    const regex = /(\d+)\s*(minutes|minute|min|hours|hour|hr|seconds|second|sec)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add the text before the match
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

    // Add the remaining text after the last match
    parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <div className="fixed inset-0 bg-white z-50 p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">{displayedRecipe.name}</h1>
            <p className="text-md text-gray-500 mt-1">Makes {displayedRecipe.servings} servings</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
          <XIcon className="w-8 h-8" />
        </button>
      </div>
      
      {needsAdjustment && (
          <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg mb-4 text-center shrink-0">
              <p className="text-sm text-yellow-800">
                  This recipe is for <strong>{displayedRecipe.servings}</strong> servings, but your settings are for <strong>{targetServings}</strong>.
              </p>
              <button onClick={handleAdjust} disabled={isAdjusting} className="mt-2 text-sm bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600 disabled:bg-yellow-300 flex items-center justify-center mx-auto">
                  {isAdjusting ? <LoadingIcon /> : `Adjust with AI`}
              </button>
          </div>
      )}

      <div className="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ingredients Column */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Ingredients</h2>
          <ul className="space-y-3">
            {ingredientsList.map((ingredient, index) => (
              <li key={index} className="flex items-start">
                  <span className="text-blue-500 font-bold mr-3 shrink-0 mt-1">•</span>
                  <span className="text-lg text-gray-700">{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions Column */}
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Instructions</h2>
          <ol className="space-y-6">
            {instructionsList.map((instruction, index) => (
              <li key={index} className="flex items-start">
                 <div 
                    onClick={() => toggleStep(index)}
                    className={`cursor-pointer shrink-0 mt-1 mr-4 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${completedSteps[index] ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                    {index + 1}
                </div>
                <p className={`text-lg leading-relaxed text-gray-800 ${completedSteps[index] ? 'opacity-50' : ''}`}>
                    {renderInstructionText(instruction)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default KitchenModeView;
