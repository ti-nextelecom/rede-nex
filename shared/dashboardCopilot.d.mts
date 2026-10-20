import type { buildWorkBriefing } from './personalWork.mjs';
import type { DashboardCommand } from './dashboardActions.mjs';
export interface DashboardConversationContext { topic?: string; projectId?: string }
export interface DashboardConversationReply { content: string; actions: Array<{ label: string; to: string }>; command?: DashboardCommand; context: DashboardConversationContext }
export function replyToDashboardQuestion(message: string, briefing: ReturnType<typeof buildWorkBriefing>, previous?: DashboardConversationContext): DashboardConversationReply;
