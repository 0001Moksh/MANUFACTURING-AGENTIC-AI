export interface MachineDocument {
  id: string;
  machineId: string;
  fileName: string;
  fileType: 'pdf' | 'doc' | 'docx' | 'md' | 'txt';
  fileUrl: string;
  uploadedAt: string;
  fileSize: number;
}

export interface KBQueryPayload {
  machineId: string;
  query: string;
}

export interface KBQueryResponse {
  answer: string;
  sources: { fileName: string; pageNumber?: number; snippet: string }[];
}
