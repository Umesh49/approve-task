import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type ChatMessage } from '@/store/chatStore';
import { useAuthStore } from '@/stores/authStore';

export function CopilotWidget() {
  const user = useAuthStore(state => state.user);
  const userId = user?.id ? String(user.id) : 'default';

  const isOpen = useChatStore(state => state.isOpen);
  const setIsOpen = useChatStore(state => state.setIsOpen);
  const messagesByUser = useChatStore(state => state.messagesByUser) || {};
  const addMessageAction = useChatStore(state => state.addMessage);

  const rawMessages = messagesByUser[userId];
  const messages: ChatMessage[] = Array.isArray(rawMessages) ? rawMessages : [{
    id: '1',
    role: 'assistant',
    content: "Hi! I'm your Workflow Copilot. Tell me what kind of approval process you want to build (e.g., 'Create a 3-stage expense workflow for marketing, assigning stage 1 to @manager')."
  }];

  const addMessage = (msg: ChatMessage) => addMessageAction(userId, msg);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [mentionType, setMentionType] = useState<'@' | '#' | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);

  // Debounced User Fetch
  useEffect(() => {
    if (mentionType !== '@') return;
    
    setIsLoadingMentions(true);
    const timer = setTimeout(() => {
      api.get(`/api/auth/users/?search=${mentionQuery}`).then(res => {
        const data = res.data.results || res.data;
        if (Array.isArray(data)) setUsers(data);
      }).catch(err => console.error("Failed to fetch users:", err))
        .finally(() => setIsLoadingMentions(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [mentionType, mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart || 0;
    setCursorPos(cursor);

    // Look backwards from cursor to find a @ or # word
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)([@#])(\w*)$/);
    if (match) {
      setMentionType(match[1] as '@' | '#');
      setMentionQuery(match[2].toLowerCase());
    } else {
      setMentionType(null);
    }
  };

  const handleMentionSelect = (item: string) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    
    // Replace the matched part
    const newTextBefore = textBeforeCursor.replace(/(?:^|\s)([@#])(\w*)$/, `$1${item} `);
    setInput(newTextBefore + textAfterCursor);
    setMentionType(null);
    
    // Restore focus and cursor smoothly
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursor = newTextBefore.length;
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const getFilteredMentions = () => {
    if (mentionType === '@') {
      return (Array.isArray(users) ? users : []).map(u => ({ type: 'user', value: u.username }));
    }
    if (mentionType === '#') {
      const roles = ['admin', 'approver', 'requester'];
      return roles
        .filter(r => r.includes(mentionQuery))
        .map(r => ({ type: 'role', value: r }));
    }
    return [];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    
    addMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map((m: any) => ({
        role: m.role,
        content: m.content
      }));

      const response = await api.post('/api/copilot/chat/', { 
        message: userMessage.content,
        history: history
      });
      const responseData = response.data;
      
      let assistantMessage: ChatMessage;

      if (responseData.type === 'workflow_action') {
        const actionData = responseData.data;
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: actionData.message || (
            actionData.intent === 'create' ? 'I have generated a draft for you. Review it below!' :
            actionData.intent === 'update' ? 'I have prepared the updates for this workflow. Review them below!' :
            actionData.intent === 'delete' ? 'Are you sure you want to delete this workflow? This action is irreversible.' :
            actionData.intent === 'approval_act' ? `Are you sure you want to ${actionData.approval_status} this request?` :
            actionData.intent === 'request_submit' ? 'I have prepared your request. Please confirm to submit.' :
            actionData.intent === 'workflow_publish' ? 'Are you ready to publish this workflow?' :
            actionData.intent === 'workflow_unpublish' ? 'Are you sure you want to unpublish this workflow?' :
            'Here is the information you requested.'
          ),
          isDraft: ['create', 'update', 'delete', 'approval_act', 'request_submit', 'workflow_publish', 'workflow_unpublish'].includes(actionData.intent),
          intent: actionData.intent,
          targetWorkflowId: actionData.target_workflow_id,
          targetRequestId: actionData.target_request_id,
          approvalStatus: actionData.approval_status,
          approvalComment: actionData.approval_comment,
          submitData: actionData.submit_data,
          draftData: actionData.draft_data
        };
      } else {
        // Fallback for standard chat or errors
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseData.message,
          isDraft: false
        };
      }
      
      addMessage(assistantMessage);
    } catch (error) {
      toast.error('Copilot is currently unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (msg: ChatMessage) => {
    try {
      const { intent, targetWorkflowId, targetRequestId, draftData } = msg;

      if (intent === 'create') {
        const toastId = toast.loading('Building workflow...');
        const uniqueName = `${draftData.name || 'AI Generated Workflow'} - ${new Date().toLocaleTimeString()}`;
        const wfResponse = await api.post('/api/workflows/', {
          name: uniqueName,
          description: draftData.description || 'Generated by Copilot'
        });
        const newWorkflowId = wfResponse.data.id;

        const stagesPayload = draftData.stages?.map((stage: any, index: number) => ({
          id: stage.id || `st-${index}`,
          name: stage.name,
          order: index,
          approver_role: stage.specific_approver ? null : (stage.approver_role || 'approver'),
          specific_approver_id: stage.specific_approver || null,
          stage_type: 'approval'
        })) || [];

        const mapRule = (rule: any): any => ({
          stage_id: rule.stage_index !== null && rule.stage_index !== undefined ? `st-${rule.stage_index}` : null,
          logical_operator: rule.logical_operator || null,
          field_name: rule.field_name,
          operator: rule.operator,
          value: rule.value,
          action: rule.action,
          target_stage_id: rule.action_target_stage_index !== null && rule.action_target_stage_index !== undefined ? `st-${rule.action_target_stage_index}` : null,
          children: rule.children ? rule.children.map(mapRule) : []
        });
        const rulesPayload = draftData.rules?.map(mapRule) || [];

        await api.post(`/api/workflows/${newWorkflowId}/sync/`, {
          name: uniqueName,
          description: draftData.description,
          stages: stagesPayload,
          rules: rulesPayload
        });

        toast.success('Workflow built successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        setIsOpen(false);
        navigate(`/workflows/${newWorkflowId}`);
        
      } else if (intent === 'update' && targetWorkflowId) {
        const toastId = toast.loading('Updating workflow...');
        const uniqueName = `${draftData.name || 'AI Generated Workflow'} - ${new Date().toLocaleTimeString()}`;
        
        let stagesPayload = draftData.stages?.map((stage: any, index: number) => ({
          id: stage.id || `st-${index}`,
          name: stage.name,
          order: index,
          approver_role: stage.specific_approver ? null : (stage.approver_role || 'approver'),
          specific_approver_id: stage.specific_approver || null,
          stage_type: 'approval'
        })) || [];

        // Fallback: if the LLM forgot to include stages during an update, fetch them from the current workflow
        if (stagesPayload.length === 0) {
          try {
            const existingWf = await api.get(`/api/workflows/${targetWorkflowId}/`);
            stagesPayload = existingWf.data.stages.map((stage: any) => ({
              id: stage.id,
              name: stage.name,
              order: stage.order,
              approver_role: stage.approver_role,
              specific_approver_id: stage.specific_approver?.id || null,
              stage_type: stage.stage_type || 'approval'
            }));
          } catch (e) {
            console.error('Failed to fetch fallback stages');
          }
        }

        const mapRule = (rule: any): any => ({
          stage_id: rule.stage_index !== null && rule.stage_index !== undefined ? `st-${rule.stage_index}` : null,
          logical_operator: rule.logical_operator || null,
          field_name: rule.field_name,
          operator: rule.operator,
          value: rule.value,
          action: rule.action,
          target_stage_id: rule.action_target_stage_index !== null && rule.action_target_stage_index !== undefined ? `st-${rule.action_target_stage_index}` : null,
          children: rule.children ? rule.children.map(mapRule) : []
        });
        const rulesPayload = draftData.rules?.map(mapRule) || [];

        try {
          // 1. Attempt to unpublish first (it unlocks the draft)
          await api.post(`/api/workflows/${targetWorkflowId}/unpublish/`);
        } catch (e: any) {
          // It's okay if it's already unpublished.
        }

        // 2. Sync the draft
        await api.post(`/api/workflows/${targetWorkflowId}/sync/`, {
          name: uniqueName,
          description: draftData.description,
          stages: stagesPayload,
          rules: rulesPayload
        });

        // 3. Publish to create a new version
        await api.post(`/api/workflows/${targetWorkflowId}/publish/`, {
          changelog: 'Copilot AI update'
        });

        toast.success('Workflow updated and published successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        setIsOpen(false);
        navigate(`/workflows/${targetWorkflowId}`);
        
      } else if (intent === 'delete' && targetWorkflowId) {
        const toastId = toast.loading('Deleting workflow...');
        await api.delete(`/api/workflows/${targetWorkflowId}/`);
        toast.success('Workflow deleted successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        setIsOpen(false);
        navigate('/workflows');
      } else if (intent === 'approval_act' && targetRequestId) {
        const actionStr = msg.approvalStatus === 'approved' ? 'Approving' : 'Rejecting';
        const toastId = toast.loading(`${actionStr} request...`);
        const endpoint = msg.approvalStatus === 'approved' ? 'approve' : 'reject';
        await api.post(`/api/requests/${targetRequestId}/${endpoint}/`, {
          comments: msg.approvalComment || `Copilot AI: ${msg.approvalStatus}`
        });
        toast.success(`Request ${msg.approvalStatus} successfully!`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        setIsOpen(false);
      } else if (intent === 'request_submit' && targetWorkflowId && msg.submitData) {
        const toastId = toast.loading('Submitting request...');
        await api.post('/api/requests/', {
          workflow: targetWorkflowId,
          title: msg.submitData.title,
          data: msg.submitData.data
        });
        toast.success('Request submitted successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        setIsOpen(false);
      } else if (intent === 'workflow_publish' && targetWorkflowId) {
        const toastId = toast.loading('Publishing workflow...');
        await api.post(`/api/workflows/${targetWorkflowId}/publish/`, { changelog: 'Published via Copilot AI' });
        toast.success('Workflow published successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        setIsOpen(false);
      } else if (intent === 'workflow_unpublish' && targetWorkflowId) {
        const toastId = toast.loading('Unpublishing workflow...');
        await api.post(`/api/workflows/${targetWorkflowId}/unpublish/`);
        toast.success('Workflow unpublished successfully!', { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        setIsOpen(false);
      }
    } catch (error: any) {
      toast.dismiss(); // Dismiss any pending loading toasts
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else if (Array.isArray(error.response?.data) && error.response.data[0]) {
        toast.error(error.response.data[0]);
      } else {
        const fallbackMsg = error.message || 'An unknown error occurred.';
        toast.error(`Action failed: ${fallbackMsg}`);
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[400px] h-[calc(100vh-8rem)] sm:h-[600px] max-h-[800px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden origin-bottom-right"
            >
              <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  <span className="font-semibold">Workflow Copilot</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-primary-foreground/20 p-1 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-sm">{msg.content}</p>
                      
                      {/* Action Card Rendering */}
                      {msg.intent && ['create', 'update'].includes(msg.intent) && msg.draftData && (
                        <div className="mt-3 bg-background border rounded-lg p-3 shadow-sm">
                          <h4 className="font-bold text-sm mb-1">{msg.draftData.name}</h4>
                          <p className="text-xs text-muted-foreground mb-3">{msg.draftData.description}</p>
                          <div className="space-y-2 mb-3">
                            {msg.draftData.stages?.map((stage: any, idx: number) => (
                              <div key={idx} className="text-xs bg-muted/50 p-2 rounded flex justify-between items-center border">
                                <span className="font-medium">{idx + 1}. {stage.name}</span>
                                <span className="text-primary">{stage.approver_role} {stage.specific_approver ? '(Specific User)' : ''}</span>
                              </div>
                            ))}
                            {Array.isArray(msg.draftData.rules) && msg.draftData.rules.length > 0 && (
                              <div className="mt-2 text-[10px] text-muted-foreground border-t pt-2">
                                <span className="font-bold">Rules:</span>
                                {msg.draftData.rules.map((r: any, idx: number) => {
                                  const renderRule = (rule: any, i: number, depth = 0): any => {
                                    if (rule.logical_operator) {
                                      return (
                                        <div key={`${depth}-${i}`} style={{ paddingLeft: depth * 12 }}>
                                          <div className="font-semibold text-primary">{depth === 0 ? `• Stage ${rule.stage_index !== null ? rule.stage_index + 1 : '?'}: ` : ''}{rule.logical_operator} {rule.action && rule.action !== 'none' ? `→ ${rule.action}` : ''}</div>
                                          {rule.children?.map((child: any, cIdx: number) => renderRule(child, cIdx, depth + 1))}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={`${depth}-${i}`} style={{ paddingLeft: depth * 12 }}>
                                        {depth === 0 ? `• Stage ${rule.stage_index !== null ? rule.stage_index + 1 : '?'}: ` : '↳ '}
                                        If {rule.field_name} {rule.operator} {rule.value} {rule.action && rule.action !== 'none' ? `→ ${rule.action}` : ''}
                                      </div>
                                    );
                                  };
                                  return renderRule(r, idx);
                                })}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
                          >
                            <CheckCircle2 className="w-4 h-4" /> {msg.intent === 'update' ? 'Confirm & Update' : 'Confirm & Create'}
                          </button>
                        </div>
                      )}
                      
                      {msg.intent === 'delete' && (
                        <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-destructive mb-3">Are you sure you want to permanently delete this workflow? This action cannot be undone.</p>
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className="w-full py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
                          >
                            Confirm & Delete
                          </button>
                        </div>
                      )}
                      
                      {msg.intent === 'approval_act' && (
                        <div className={`mt-3 ${msg.approvalStatus === 'approved' ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'} border rounded-lg p-3 shadow-sm`}>
                          <p className={`text-xs ${msg.approvalStatus === 'approved' ? 'text-green-600' : 'text-destructive'} mb-2 font-medium`}>
                            {msg.approvalStatus === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">
                            <span className="font-bold">Comment: </span> 
                            {msg.approvalComment || `Copilot AI: ${msg.approvalStatus}`}
                          </p>
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className={`w-full py-2 ${msg.approvalStatus === 'approved' ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'} rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> 
                            {msg.approvalStatus === 'approved' ? 'Approve Request' : 'Reject Request'}
                          </button>
                        </div>
                      )}

                      {msg.intent === 'request_submit' && msg.submitData && (
                        <div className="mt-3 bg-muted/50 border rounded-lg p-3">
                          <h4 className="font-bold text-sm mb-2">{msg.submitData.title}</h4>
                          {msg.submitData.data && typeof msg.submitData.data === 'object' && (
                            <div className="space-y-1">
                              {Object.entries(msg.submitData.data).map(([key, val]) => (
                                <div key={key} className="text-xs flex gap-2">
                                  <span className="font-semibold text-muted-foreground w-24 shrink-0">{key}:</span>
                                  <span>{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className="mt-3 w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Confirm & Submit Request
                          </button>
                        </div>
                      )}

                      {msg.intent === 'workflow_publish' && (
                        <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-purple-700 mb-3 font-medium">Publishing this workflow will create a new active version and make it available for users to submit requests.</p>
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className="w-full py-2 bg-purple-600 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Confirm & Publish
                          </button>
                        </div>
                      )}

                      {msg.intent === 'workflow_unpublish' && (
                        <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-orange-700 mb-3 font-medium">Unpublishing will lock this workflow so no new requests can be submitted, but it allows you to safely edit the draft.</p>
                          <button 
                            onClick={() => handleConfirmAction(msg)}
                            className="w-full py-2 bg-orange-600 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
                          >
                            Confirm & Unpublish
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                      <div className="bg-muted p-3 rounded-2xl flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSubmit} className="p-4 border-t bg-background relative">
                
                {/* Autocomplete Popover */}
                {mentionType && (getFilteredMentions().length > 0 || isLoadingMentions) && (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-4 w-64 bg-background border rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground border-b">
                      Select a {mentionType === '@' ? 'User' : 'Role'}
                    </div>
                    <ul className="max-h-40 overflow-y-auto">
                      {isLoadingMentions && (
                        <li className="px-3 py-3 text-sm text-muted-foreground flex justify-center items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                        </li>
                      )}
                      {!isLoadingMentions && getFilteredMentions().length === 0 && (
                        <li className="px-3 py-3 text-sm text-muted-foreground text-center">
                          No matches found
                        </li>
                      )}
                      {!isLoadingMentions && getFilteredMentions().map(item => (
                        <li 
                          key={`${item.type}-${item.value}`} 
                          onClick={() => handleMentionSelect(item.value)}
                          className="px-3 py-2 text-sm hover:bg-primary hover:text-primary-foreground cursor-pointer flex items-center gap-2"
                        >
                          {item.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          {item.value}
                          <span className="text-[10px] uppercase opacity-50 ml-auto">{item.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask me to build a workflow..."
                    className="w-full pr-12 pl-4 py-3 bg-muted rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1.5 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {!isOpen && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </div>
    </>
  );
}
