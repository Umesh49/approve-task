import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isDraft?: boolean;
  intent?: 'create' | 'read' | 'update' | 'delete' | 'approval_act' | 'request_read' | 'request_submit' | 'rule_explain' | 'workflow_publish' | 'workflow_unpublish';
  targetWorkflowId?: string | null;
  targetRequestId?: string | null;
  approvalStatus?: 'approved' | 'rejected' | null;
  approvalComment?: string | null;
  submitData?: { title: string; data: any } | null;
  draftData?: any;
}

interface ChatState {
  isOpen: boolean;
  messagesByUser: Record<string, ChatMessage[]>;
  setIsOpen: (isOpen: boolean) => void;
  addMessage: (userId: string, message: ChatMessage) => void;
  clearChat: (userId: string) => void;
}

const DEFAULT_MESSAGES: ChatMessage[] = [{
  id: '1',
  role: 'assistant',
  content: "Hi! I'm your Workflow Copilot. Tell me what kind of approval process you want to build (e.g., 'Create a 3-stage expense workflow for marketing, assigning stage 1 to @manager')."
}];

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      messagesByUser: {},
      setIsOpen: (isOpen) => set({ isOpen }),
      addMessage: (userId, message) => set((state) => ({ 
        messagesByUser: {
          ...state.messagesByUser,
          [userId]: [...(state.messagesByUser[userId] || DEFAULT_MESSAGES), message]
        }
      })),
      clearChat: (userId) => set((state) => ({ 
        messagesByUser: {
          ...state.messagesByUser,
          [userId]: DEFAULT_MESSAGES
        }
      }))
    }),
    {
      name: 'copilot-chat-storage-v2', // saves to localStorage
    }
  )
);
