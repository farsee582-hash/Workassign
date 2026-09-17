export type Role = 'GMA' | 'AGM' | 'COORDINATOR' | 'MANAGER' | 'ASSISTANT_MANAGER' | 'EXECUTIVE' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  departmentId: string | null;
  employeeId: string;
  designation: string | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  subDepartments: SubDepartment[];
}

export interface SubDepartment {
  id: string;
  name: string;
  departmentId: string;
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  mobile: string | null;
  departmentId: string | null;
  subDepartmentId: string | null;
  designation: string | null;
  role: Role;
  reportingManagerId: string | null;
  joiningDate: string | null;
  status: string;
  username: string;
  permissionLevel: number;
  /** Count of this user's currently-open (not completed/cancelled) assigned tasks.
   * Only present on the /users list response used by Organization & Access. */
  openWorkCount?: number;
}

export interface CampaignAccessRow {
  id: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  userId: string | null;
  user: { id: string; name: string; departmentId: string | null } | null;
}

export interface Campaign {
  id: string;
  code: string;
  campaignNumber: string | null;
  name: string;
  type: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  coordinatorId: string | null;
  coordinator: { id: string; name: string } | null;
  priority: string;
  status: string;
  notes: string | null;
  departments: { department: Department }[];
  access: CampaignAccessRow[];
  _count?: { tasks: number };
}

export interface CampaignMessage {
  id: string;
  campaignId: string;
  userId: string;
  user: { id: string; name: string; department: { name: string } | null };
  text: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentData: string | null;
  createdAt: string;
}

export interface RecurringWorkTemplate {
  id: string;
  title: string;
  description: string | null;
  departmentId: string;
  department: { id: string; name: string };
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  recurrenceType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  weekday: number | null;
  dayOfMonth: number | null;
  priority: string;
  active: boolean;
  createdBy: { id: string; name: string };
  startDate: string;
  endDate: string | null;
}

export interface Task {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  workType: 'CAMPAIGN' | 'DAILY';
  campaignId: string | null;
  campaign: { id: string; name: string; code: string } | null;
  departmentId: string;
  department: { id: string; name: string };
  subDepartmentId: string | null;
  subDepartment: { id: string; name: string } | null;
  assignedToId: string;
  assignedTo: { id: string; name: string };
  createdById: string;
  createdBy: { id: string; name: string };
  reviewerId: string | null;
  reviewer: { id: string; name: string } | null;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  completionPercent: number;
  approvalStatus: string;
  recurringTemplateId?: string | null;
  overdue: boolean;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user: { id: string; name: string };
  text: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  createdAt: string;
}

export interface CampaignProgress {
  campaignId: string;
  campaignName: string;
  departments: {
    department: { id: string; name: string };
    taskCount: number;
    completedCount: number;
    completionPercent: number;
    tasks: {
      id: string;
      taskId: string;
      title: string;
      status: string;
      completionPercent: number;
      assignedTo: string;
      dueDate: string;
      overdue: boolean;
    }[];
  }[];
}

export interface MyDashboard {
  counts: {
    total: number;
    pending: number;
    inProgress: number;
    dueToday: number;
    dueTomorrow: number;
    overdue: number;
    completed: number;
  };
  dueToday: Task[];
  dueTomorrow: Task[];
  dueThisWeek: Task[];
  overdueTasks: Task[];
}

export interface ManagementDashboard {
  filters: { range: string; departmentId: string | null; role: string | null };
  campaigns: { total: number; active: number; completed: number };
  tasks: { total: number; pending: number; completed: number; overdue: number };
  staffWithPendingWork: { id: string; name: string; count: number }[];
  departmentCompletion: { id: string; name: string; total: number; completed: number; completionPercent: number }[];
  campaignProgress: { id: string; name: string; campaignNumber: string | null; status: string; taskCount: number; completionPercent: number }[];
}

export interface CampaignDashboard {
  campaignId: string;
  campaignName: string;
  kpis: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completionPercent: number;
  };
  departmentCompletion: { id: string; name: string; total: number; completed: number; completionPercent: number }[];
  staffWorkload: { id: string; name: string; total: number; pending: number }[];
  priorityBreakdown: { priority: string; count: number }[];
}
