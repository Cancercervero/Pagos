export interface UserData {
    id: string;
    email: string;
    displayName?: string;
    createdAt: Date;
}

export interface FirestoreDocument {
    id: string;
    [key: string]: any;
}
