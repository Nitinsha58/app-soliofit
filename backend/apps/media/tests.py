import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.media.models import OrderPhoto, VoiceNote
from apps.orders.models import Order
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


class MediaKeyValidationTests(TestCase):
    """The s3_key stored on a media row is later trusted by the cleanup path, so
    create must reject anything outside the presign contract, and public_url must
    be derived server-side (never trusted from the client)."""

    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        self.customer = Customer.objects.create(user=self.user, name='Alice', phone='9999999999')
        self.order = Order.objects.create(
            user=self.user, customer=self.customer, order_number=1,
            delivery_date=date.today() + timedelta(days=10), total_amount=Decimal('100.00'),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _photos_url(self):
        return f'/api/orders/{self.order.id}/photos/'

    def _voice_url(self):
        return f'/api/orders/{self.order.id}/voice-notes/'

    def test_valid_photo_key_accepted_and_public_url_derived(self):
        key = f'photos/{uuid.uuid4()}.jpg'
        resp = self.client.post(self._photos_url(), {
            's3_key': key, 'public_url': 'http://evil.example/owned', 'photo_type': 'garment',
        })
        self.assertEqual(resp.status_code, 201)
        photo = OrderPhoto.objects.get(id=resp.data['id'])
        self.assertEqual(photo.s3_key, key)
        # Client-sent public_url is ignored; server derives it from the key.
        self.assertNotIn('evil.example', photo.public_url)
        self.assertIn(key, photo.public_url)

    def test_forged_photo_key_rejected(self):
        for bad in ['photos/../../etc/passwd', '/etc/passwd', 'photos/not-a-uuid.jpg',
                    'voice-notes/' + str(uuid.uuid4()) + '.webm', 'photos/' + str(uuid.uuid4()) + '.exe']:
            resp = self.client.post(self._photos_url(), {'s3_key': bad, 'photo_type': 'garment'})
            self.assertEqual(resp.status_code, 400, f'expected 400 for {bad!r}')
        self.assertEqual(OrderPhoto.objects.count(), 0)

    def test_valid_voice_key_accepted(self):
        key = f'voice-notes/{uuid.uuid4()}.webm'
        resp = self.client.post(self._voice_url(), {'s3_key': key, 'duration_seconds': 3})
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(VoiceNote.objects.get(id=resp.data['id']).s3_key, key)

    def test_forged_voice_key_rejected(self):
        for bad in ['voice-notes/../secret', 'photos/' + str(uuid.uuid4()) + '.jpg',
                    'voice-notes/not-a-uuid.webm']:
            resp = self.client.post(self._voice_url(), {'s3_key': bad, 'duration_seconds': 3})
            self.assertEqual(resp.status_code, 400, f'expected 400 for {bad!r}')
        self.assertEqual(VoiceNote.objects.count(), 0)
