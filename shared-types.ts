/**
 * Shared types between client (www) and server (do)
 * This file should be accessible to both projects
 */

// ============== Domain Models ==============

export interface ChatMessage {
	id: string;
	chatId: string;
	content: string;
	role: "user" | "assistant" | "system";
	timestamp: number;
	metadata?: Record<string, any>;
}

export interface Chat {
	id: string;
	spaceId: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	position: number;
	metadata?: Record<string, any>;
	model?: string;
}

export interface SpaceData {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	metadata?: Record<string, any>;
}

// ============== WebSocket Protocol ==============

export interface WebSocketMessage {
	id: string;
	method: string;
	params?: any;
}

export interface WebSocketResponse {
	id: string;
	result?: any;
	error?: string;
}

// ============== API Request/Response Types ==============

export interface CreateChatRequest {
	name?: string;
	metadata?: Record<string, any>;
}

export interface CreateChatResponse extends Chat {}

export interface AddMessageRequest {
	content: string;
	role: "user" | "assistant" | "system";
	metadata?: Record<string, any>;
}

export interface AddMessageResponse extends ChatMessage {}

export interface UpdateMetadataRequest {
	metadata: Record<string, any>;
}

export interface GetMessagesParams {
	limit?: number;
	offset?: number;
}

export interface GetChatsParams {
	limit?: number;
	offset?: number;
}

export interface DeleteResponse {
	success: boolean;
}

export interface ClearMessagesResponse {
	deletedCount: number;
}

export interface CountResponse {
	count: number;
}

// ============== WebSocket Method Types ==============

export type WebSocketMethod =
	// Space methods
	| "getOrCreateSpace"
	| "updateSpaceMetadata"
	// Chat methods
	| "createChat"
	| "getChats"
	| "getChat"
	| "updateChatMetadata"
	| "deleteChat"
	| "getChatCount"
	// Message methods
	| "addMessage"
	| "getMessages"
	| "getMessage"
	| "deleteMessage"
	| "getMessageCount"
	| "clearMessages";

export interface WebSocketMethodParams {
	// Space methods
	getOrCreateSpace?: { name?: string };
	updateSpaceMetadata: { metadata: Record<string, any> };

	// Chat methods
	createChat?: { name?: string; metadata?: Record<string, any> };
	getChats?: GetChatsParams;
	getChat: { chatId: string };
	updateChatMetadata: { chatId: string; metadata: Record<string, any> };
	deleteChat: { chatId: string };
	getChatCount?: never;

	// Message methods
	addMessage: {
		chatId: string;
		content: string;
		role: "user" | "assistant" | "system";
		metadata?: Record<string, any>;
	};
	getMessages: { chatId: string } & GetMessagesParams;
	getMessage: { messageId: string };
	deleteMessage: { messageId: string };
	getMessageCount: { chatId: string };
	clearMessages: { chatId: string };
}

// ============== Error Types ==============

export interface APIError {
	error: string;
	message?: string;
}

// ============== Type Guards ==============

export function isAPIError(response: any): response is APIError {
	return response && typeof response.error === "string";
}

export function isChatMessage(obj: any): obj is ChatMessage {
	return (
		obj &&
		typeof obj.id === "string" &&
		typeof obj.chatId === "string" &&
		typeof obj.content === "string" &&
		["user", "assistant", "system"].includes(obj.role) &&
		typeof obj.timestamp === "number"
	);
}

export function isChat(obj: any): obj is Chat {
	return (
		obj &&
		typeof obj.id === "string" &&
		typeof obj.spaceId === "string" &&
		typeof obj.name === "string" &&
		typeof obj.createdAt === "number" &&
		typeof obj.updatedAt === "number"
	);
}

export function isSpaceData(obj: any): obj is SpaceData {
	return (
		obj &&
		typeof obj.id === "string" &&
		typeof obj.name === "string" &&
		typeof obj.createdAt === "number" &&
		typeof obj.updatedAt === "number"
	);
}
