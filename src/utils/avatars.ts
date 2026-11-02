// 내 정보 → 프로필 사진: a character (emoji on a pastel circle) or the user's own photo.
// Photos are shrunk to a small square JPEG and kept in the planner data on this device only.
import { ProfileAvatar } from '../types';
import { SUBJECT_COLORS, SUBJECT_COLOR_KEYS } from './subjectColors';

export interface AvatarCharacter {
  id: string;
  emoji: string;
  bg: string;
}

const bgAt = (i: number) => SUBJECT_COLORS[SUBJECT_COLOR_KEYS[i % SUBJECT_COLOR_KEYS.length]].bg;

const PEOPLE = ['👦', '👧', '🧒', '🧑', '👩‍🎓', '👨‍🎓', '🦸', '🦸‍♀️', '🧙', '🧚', '🥷', '🧑‍🚀', '🧑‍🎨', '🧑‍💻', '🤖'];
const ANIMALS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🦊', '🐯', '🦁', '🐸', '🐵', '🐧', '🐥', '🦄', '🐹', '🐳', '🦖', '🐙'];

export const PEOPLE_CHARACTERS: AvatarCharacter[] = PEOPLE.map((emoji, i) => ({ id: `p${i + 1}`, emoji, bg: bgAt(i * 5) }));
export const ANIMAL_CHARACTERS: AvatarCharacter[] = ANIMALS.map((emoji, i) => ({ id: `a${i + 1}`, emoji, bg: bgAt(i * 5 + 2) }));

export function findCharacter(id: string): AvatarCharacter | undefined {
  return PEOPLE_CHARACTERS.find((c) => c.id === id) ?? ANIMAL_CHARACTERS.find((c) => c.id === id);
}

/** Output size (px) of an uploaded photo. 256 is sharp at 3x on the largest avatar (80px). */
const PHOTO_PX = 256;

/** Reads an image file and returns a centred square JPEG data URL (about 15–30 KB). */
export function photoToAvatar(file: File): Promise<ProfileAvatar> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return reject(new Error('empty image'));
      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_PX;
      canvas.height = PHOTO_PX;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        PHOTO_PX,
        PHOTO_PX
      );
      resolve({ kind: 'photo', src: canvas.toDataURL('image/jpeg', 0.82) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not an image'));
    };
    img.src = url;
  });
}
