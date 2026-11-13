import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StreakState, loadStreakState, recordActivity } from '../utils/streakManager';

interface StreakContextType {
  streak: StreakState;
  recordStudyActivity: (toolName: 'pomodoro' | 'flashcards' | 'research') => void;
  recentMilestone: string | null;
  clearRecentMilestone: () => void;
}

const StreakContext = createContext<StreakContextType | undefined>(undefined);

export const StreakProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [streak, setStreak] = useState<StreakState>(loadStreakState);
  const [recentMilestone, setRecentMilestone] = useState<string | null>(null);

  const recordStudyActivity = (toolName: 'pomodoro' | 'flashcards' | 'research') => {
    const { newState, newlyUnlocked } = recordActivity(toolName);
    setStreak(newState);
    if (newlyUnlocked) {
      setRecentMilestone(newlyUnlocked);
    }
  };

  const clearRecentMilestone = () => {
    setRecentMilestone(null);
  };

  return (
    <StreakContext.Provider
      value={{
        streak,
        recordStudyActivity,
        recentMilestone,
        clearRecentMilestone,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error('useStreak must be used within a StreakProvider');
  }
  return context;
};
