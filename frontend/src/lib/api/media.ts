import { apiRequest } from './client'

export interface VoiceNote {
  id: string
  s3_key: string
  public_url: string
  duration_seconds: number
  created_at: string
}

export async function listVoiceNotes(orderId: string): Promise<VoiceNote[]> {
  return apiRequest(`/api/orders/${orderId}/voice-notes/`)
}

export async function saveVoiceNote(
  orderId: string,
  s3Key: string,
  publicUrl: string,
  durationSeconds: number,
): Promise<VoiceNote> {
  return apiRequest(`/api/orders/${orderId}/voice-notes/`, {
    method: 'POST',
    body: JSON.stringify({ s3_key: s3Key, public_url: publicUrl, duration_seconds: durationSeconds }),
  })
}

export async function deleteVoiceNote(orderId: string, noteId: string): Promise<void> {
  return apiRequest(`/api/orders/${orderId}/voice-notes/${noteId}/`, { method: 'DELETE' })
}

export interface OrderPhoto {
  id: string
  s3_key: string
  public_url: string
  photo_type: 'garment' | 'notes'
  display_order: number
  created_at: string
}

export async function presignUpload(
  folder: string,
  filename: string,
  contentType: string,
  size?: number,
): Promise<{ upload_url: string; public_url: string; s3_key: string; content_type: string }> {
  return apiRequest('/api/upload/presign/', {
    method: 'POST',
    body: JSON.stringify({ folder, filename, content_type: contentType, size }),
  })
}

// contentType MUST be the value returned by presignUpload — a presigned PUT pins the
// exact ContentType it was signed with, so the upload header has to match it (a raw
// blob.type with a codec suffix would 403 on S3).
export async function uploadToStorage(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}

export async function savePhoto(
  orderId: string,
  s3Key: string,
  publicUrl: string,
  photoType: 'garment' | 'notes',
): Promise<OrderPhoto> {
  return apiRequest(`/api/orders/${orderId}/photos/`, {
    method: 'POST',
    body: JSON.stringify({ s3_key: s3Key, public_url: publicUrl, photo_type: photoType }),
  })
}

export async function listPhotos(orderId: string): Promise<OrderPhoto[]> {
  return apiRequest(`/api/orders/${orderId}/photos/`)
}

export async function deletePhoto(orderId: string, photoId: string): Promise<void> {
  return apiRequest(`/api/orders/${orderId}/photos/${photoId}/`, { method: 'DELETE' })
}

export async function uploadPhoto(
  orderId: string,
  file: File,
  photoType: 'garment' | 'notes',
): Promise<OrderPhoto> {
  const { upload_url, public_url, s3_key, content_type } = await presignUpload(
    'photos',
    file.name,
    file.type || 'image/jpeg',
    file.size,
  )
  await uploadToStorage(upload_url, file, content_type)
  return savePhoto(orderId, s3_key, public_url, photoType)
}
