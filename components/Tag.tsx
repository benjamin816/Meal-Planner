
import React from 'react';
import { RecipeTag } from '../types';

interface TagProps {
  tag: RecipeTag;
}

const TAG_COLORS: Record<RecipeTag, string> = {
  'affordable': 'bg-green-100 text-green-800',
  'high protein': 'bg-blue-100 text-blue-800',
  'low cal': 'bg-yellow-100 text-yellow-800',
  'high cal': 'bg-red-100 text-red-800',
  'premium': 'bg-purple-100 text-purple-800',
  'easy to cook': 'bg-teal-100 text-teal-800',
  'longer to cook': 'bg-orange-100 text-orange-800',
  'on-the-go': 'bg-cyan-100 text-cyan-800',
  'microwave': 'bg-pink-100 text-pink-800',
  'needs prepared': 'bg-gray-100 text-gray-800',
};


const Tag: React.FC<TagProps> = ({ tag }) => {
  const colorClass = TAG_COLORS[tag] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {tag}
    </span>
  );
};

export default Tag;
