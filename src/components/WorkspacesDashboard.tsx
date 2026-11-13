import React from 'react';
import { DailyAffirmation } from './DailyAffirmation';
import { Dashboard } from './Dashboard';

export interface WorkspacesDashboardProps {
  onOpenWorkspace?: (workspaceKey: string, cardDomId?: string) => void;
}

export const WorkspacesDashboard: React.FC<WorkspacesDashboardProps> = ({ onOpenWorkspace }) => {
  return (
    <div className="space-y-6">
      <DailyAffirmation />
      <Dashboard onOpenWorkspace={onOpenWorkspace} />
    </div>
  );
};

export default WorkspacesDashboard;
