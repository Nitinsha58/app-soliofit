from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User

PRESIGN_URL = '/api/upload/presign/'


class PresignValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_rejected(self):
        client = APIClient()
        resp = client.post(PRESIGN_URL, {'folder': 'photos', 'content_type': 'image/jpeg'})
        self.assertEqual(resp.status_code, 401)

    def test_photo_happy_path(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'photos', 'filename': 'x.jpg',
            'content_type': 'image/jpeg', 'size': 1024,
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['content_type'], 'image/jpeg')
        self.assertTrue(resp.data['s3_key'].startswith('photos/'))
        self.assertTrue(resp.data['s3_key'].endswith('.jpg'))

    def test_codec_suffix_is_normalized(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'voice-notes', 'content_type': 'audio/webm;codecs=opus',
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['content_type'], 'audio/webm')
        self.assertTrue(resp.data['s3_key'].endswith('.webm'))

    def test_extension_from_content_type_not_filename(self):
        # Client claims a .exe filename but a valid image type — ext follows the type.
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'photos', 'filename': 'evil.exe', 'content_type': 'image/png',
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['s3_key'].endswith('.png'))

    def test_disallowed_content_type_rejected(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'photos', 'content_type': 'application/x-msdownload',
        })
        self.assertEqual(resp.status_code, 400)

    def test_disallowed_folder_rejected(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'secrets', 'content_type': 'image/jpeg',
        })
        self.assertEqual(resp.status_code, 400)

    def test_traversal_folder_rejected(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': '../../etc', 'content_type': 'image/jpeg',
        })
        self.assertEqual(resp.status_code, 400)

    def test_oversize_rejected(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'photos', 'content_type': 'image/jpeg',
            'size': 20 * 1024 * 1024 + 1,
        })
        self.assertEqual(resp.status_code, 400)

    def test_invalid_size_rejected(self):
        resp = self.client.post(PRESIGN_URL, {
            'folder': 'photos', 'content_type': 'image/jpeg', 'size': 'huge',
        })
        self.assertEqual(resp.status_code, 400)
