import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc } from 'firebase/firestore';

let env;
const projectId = 'demo-security-fixes';
const record = { uid: 'owner-a', unlockedDate: '2026-10-22', updatedAt: 1 };
const gate = (db) => doc(db, 'gates', 'known-shared-read-secret');
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 18080,
    rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  }});
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => setDoc(gate(context.firestore()), record));
});
after(async () => { await env?.cleanup(); });

test('owner can create, update and delete their gate', async () => {
  const db = env.authenticatedContext('owner-a').firestore();
  await assertSucceeds(setDoc(doc(db, 'gates', 'new-gate'), record));
  await assertSucceeds(updateDoc(gate(db), { unlockedDate: '2026-10-23', updatedAt: 2 }));
  await assertSucceeds(deleteDoc(gate(db)));
});

test('another user cannot take ownership by replacing the uid', async () => {
  const db = env.authenticatedContext('attacker-b').firestore();
  await assertFails(setDoc(gate(db), { ...record, uid: 'attacker-b' }));
  await assertFails(updateDoc(gate(db), { uid: 'attacker-b', unlockedDate: '2099-01-01' }));
  await assertFails(updateDoc(gate(db), { unlockedDate: '2099-01-01' }));
  await assertFails(deleteDoc(gate(db)));
});

test('owners cannot transfer gates or create a gate for a different uid', async () => {
  const db = env.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(gate(db), { uid: 'attacker-b' }));
  await assertFails(setDoc(doc(db, 'gates', 'other-uid'), { ...record, uid: 'attacker-b' }));
});

test('Shortcut still reads a known gate anonymously but cannot list or write', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(gate(db)));
  await assertFails(getDocs(collection(db, 'gates')));
  await assertFails(setDoc(doc(db, 'gates', 'anonymous-created'), record));
  await assertFails(updateDoc(gate(db), { unlockedDate: '2099-01-01' }));
  await assertFails(deleteDoc(gate(db)));
});

test('gate change does not weaken ownership checks for private characters', async () => {
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'characters', 'owner-a'), { name: 'private' }));
  const attacker = env.authenticatedContext('attacker-b').firestore();
  await assertFails(getDoc(doc(attacker, 'characters', 'owner-a')));
  await assertFails(updateDoc(doc(attacker, 'characters', 'owner-a'), { name: 'changed' }));
});
