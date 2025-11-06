
import React from 'react';
import { Tab } from '../types';
import { TABS } from '../constants';
import { CalendarIcon, SettingsIcon } from './Icons';

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-center pb-4 border-b border-gray-200">
      <div className="flex items-center mb-4 md:mb-0">
        <CalendarIcon />
        <h1 className="text-3xl font-bold text-gray-800 ml-3">AI Meal Planner</h1>
      </div>
      <nav className="bg-gray-100 p-1 rounded-lg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
              activeTab.id === tab.id
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default Header;