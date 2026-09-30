import { api } from './api';

export type OperationsCitation = {
  document_id: string;
  section: string;
  page: number | null;
  source: string;
};

export type OperationsDocument = {
  name: string;
  path: string;
  document_id: string;
  type: string;
  size: number;
  uploaded_at: number;
};

type OperationsDocumentsResponse = {
  documents: OperationsDocument[];
  index_updated_at: number;
};

export type OperationsChatResponse = {
  status: 'success';
  thread_id: string;
  reply: string;
  citations: OperationsCitation[];
};

export type OperationsDocumentContent = Pick<OperationsDocument, 'name' | 'path' | 'document_id'> & {
  content: string;
};

export const operationsAgentService = {
  listDocuments: async (): Promise<OperationsDocumentsResponse> => {
    const response = await api.get<OperationsDocumentsResponse>('/operations/documents');
    return response.data;
  },
  getDocumentContent: async (path: string): Promise<OperationsDocumentContent> => {
    const response = await api.get<OperationsDocumentContent>('/operations/documents/content', {
      params: { path },
    });
    return response.data;
  },
  uploadDocument: async (file: File): Promise<OperationsDocumentsResponse & { name: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<OperationsDocumentsResponse & { name: string }>(
      '/operations/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
  chat: async (message: string, threadId: string): Promise<OperationsChatResponse> => {
    const response = await api.post<OperationsChatResponse>('/operations/chat', {
      message,
      thread_id: threadId,
    });
    return response.data;
  },
};
