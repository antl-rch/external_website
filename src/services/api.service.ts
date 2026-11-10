import axios from 'axios';
import type { Challenge, DeriveKeyFunction, Solution } from 'altcha-lib/types';

const API_URL = import.meta.env.VITE_OLYMPE_API_URL || 'http://localhost:8800/api';

// Création d'une instance axios configurée
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

interface ContactFormData {
  company: string;
  email: string;
  phone: string;
  message: string;
  website: string;
}

interface ContactChallenge {
  challenge: Challenge;
  minWaitMs: number;
  ttlMs: number;
  receivedAt: number;
}

const deriveContactKey: DeriveKeyFunction = async ({ algorithm, cost, keyLength }, salt, password) => {
  if (algorithm !== 'PBKDF2/SHA-256') throw new Error('Algorithme ALTCHA inattendu');
  const key = await crypto.subtle.importKey('raw', new Uint8Array(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: cost },
    key,
    keyLength * 8,
  );
  return { parameters: {}, derivedKey: new Uint8Array(bits) };
};

export async function loadContactChallenge(): Promise<ContactChallenge | null | undefined> {
  try {
    const { data } = await apiClient.get<Omit<ContactChallenge, 'receivedAt'>>(
      '/site-vitrine/contact/challenge',
      { timeout: 10_000 },
    );
    return { ...data, receivedAt: performance.now() };
  } catch (error) {
    // Compatibilité pendant la publication du site avant celle de l'API.
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    return undefined;
  }
}

interface CandidatureFormData {
  civility: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  cv: File;
  coverLetter: File | null;
}

/**
 * Envoie un email de contact/devis via l'API Olympe
 */
export async function sendContactEmail(
  data: ContactFormData,
  pendingChallenge: ReturnType<typeof loadContactChallenge>,
): Promise<boolean> {
  try {
    let prepared = await pendingChallenge;
    if (prepared === undefined || (prepared && performance.now() - prepared.receivedAt >= prepared.ttlMs - 30_000)) {
      prepared = await loadContactChallenge();
    }
    if (prepared === undefined) return false;

    let altcha: { nonce: string; solution: Solution } | undefined;
    if (prepared) {
      const { challenge, minWaitMs, receivedAt } = prepared;
      const { solveChallenge } = await import('altcha-lib');
      const solution = await solveChallenge({ challenge, deriveKey: deriveContactKey, timeout: 15_000 });
      if (!solution) return false;

      const wait = minWaitMs - (performance.now() - receivedAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      altcha = { nonce: challenge.parameters.nonce, solution };
    }

    const response = await apiClient.post('/site-vitrine/contact', { ...data, altcha }, { timeout: 20_000 });

    return response.data.success === true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de contact:', error);
    return false;
  }
}

/**
 * Envoie une candidature spontanée avec CV et lettre de motivation via l'API Olympe
 */
export async function sendCandidatureEmail(data: CandidatureFormData): Promise<boolean> {
  try {
    // Créer FormData pour l'upload de fichiers
    const formData = new FormData();

    // Ajouter les champs texte
    formData.append('civility', data.civility);
    formData.append('firstName', data.firstName);
    formData.append('lastName', data.lastName);
    formData.append('phone', data.phone);
    formData.append('email', data.email);

    // Ajouter les fichiers
    if (data.cv) {
      formData.append('cv', data.cv);
    }

    if (data.coverLetter) {
      formData.append('coverLetter', data.coverLetter);
    }

    const response = await apiClient.post('/site-vitrine/candidature', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.success === true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la candidature:', error);
    return false;
  }
}

export default apiClient;
