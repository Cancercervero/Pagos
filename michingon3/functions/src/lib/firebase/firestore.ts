// Firestore helper functions
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    QueryConstraint,
    DocumentData,
    CollectionReference
} from 'firebase/firestore';
import { db } from './config';

// Get a document by ID
export const getDocument = async (collectionName: string, docId: string) => {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    } else {
        return null;
    }
};

// Get all documents from a collection
export const getDocuments = async (collectionName: string) => {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Add a document
export const addDocument = async (collectionName: string, data: DocumentData) => {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
};

// Update a document
export const updateDocument = async (collectionName: string, docId: string, data: DocumentData) => {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, data);
};

// Delete a document
export const deleteDocument = async (collectionName: string, docId: string) => {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
};

// Query documents
export const queryDocuments = async (collectionName: string, ...constraints: QueryConstraint[]) => {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
