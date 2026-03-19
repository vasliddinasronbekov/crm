"""
File Upload Views for Messages

Handles photo and document attachments in conversations
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
import uuid
from .models import Conversation, ChatMessage
from PIL import Image
from io import BytesIO
from users.branch_scope import (
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
)


# File upload size limits (in MB)
MAX_IMAGE_SIZE = 10  # 10MB
MAX_DOCUMENT_SIZE = 25  # 25MB

# Allowed file types
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
]


def _conversation_with_branch_scope(conversation_id, request):
    queryset = Conversation.objects.filter(id=conversation_id)
    active_branch_id = get_effective_branch_id(request, request.user)

    if is_global_branch_user(request.user):
        if active_branch_id is None:
            return queryset.first()
    elif active_branch_id is None:
        return None

    return queryset.filter(
        build_user_branch_q(active_branch_id, 'user')
        | build_user_branch_q(active_branch_id, 'participants')
    ).distinct().first()


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses=OpenApiTypes.OBJECT,
    description='Upload and attach a file to a conversation message.'
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_message_attachment(request):
    """
    Upload a file attachment for a message

    POST /api/messaging/upload/
    Body (multipart/form-data):
        - conversation_id: int
        - file: File
        - type: 'image' or 'document' (optional, auto-detected)

    Returns:
        - message_id: int
        - file_url: string
        - thumbnail_url: string (for images)
        - file_name: string
        - file_size: int (bytes)
    """
    conversation_id = request.data.get('conversation_id')
    uploaded_file = request.FILES.get('file')

    # Validation
    if not conversation_id:
        return Response(
            {'error': 'conversation_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not uploaded_file:
        return Response(
            {'error': 'file is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify conversation access
    conversation = _conversation_with_branch_scope(conversation_id, request)
    if conversation is None:
        return Response(
            {'error': 'Conversation not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    if not conversation.participants.filter(id=request.user.id).exists():
        return Response(
            {'error': 'Access denied to this conversation'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Detect file type
    content_type = uploaded_file.content_type
    file_size = uploaded_file.size

    is_image = content_type in ALLOWED_IMAGE_TYPES
    is_document = content_type in ALLOWED_DOCUMENT_TYPES

    if not is_image and not is_document:
        return Response(
            {'error': f'File type {content_type} not allowed'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check file size
    max_size = (MAX_IMAGE_SIZE if is_image else MAX_DOCUMENT_SIZE) * 1024 * 1024  # Convert to bytes
    if file_size > max_size:
        return Response(
            {'error': f'File size exceeds maximum of {MAX_IMAGE_SIZE if is_image else MAX_DOCUMENT_SIZE}MB'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Generate unique filename
        ext = os.path.splitext(uploaded_file.name)[1]
        unique_filename = f"{uuid.uuid4()}{ext}"

        # Determine upload directory
        upload_dir = 'messages/images' if is_image else 'messages/documents'
        file_path = os.path.join(upload_dir, unique_filename)

        # Save file
        saved_path = default_storage.save(file_path, ContentFile(uploaded_file.read()))
        file_url = default_storage.url(saved_path)

        # Generate thumbnail for images
        thumbnail_url = None
        if is_image:
            thumbnail_url = generate_thumbnail(saved_path)

        # Create message with attachment
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            content=f"[{'Image' if is_image else 'Document'} attachment: {uploaded_file.name}]",
            attachment_url=file_url,
            attachment_type='image' if is_image else 'document',
            attachment_name=uploaded_file.name,
            attachment_size=file_size,
        )

        return Response({
            'message_id': message.id,
            'file_url': file_url,
            'thumbnail_url': thumbnail_url,
            'file_name': uploaded_file.name,
            'file_size': file_size,
            'file_type': 'image' if is_image else 'document',
            'created_at': message.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {'error': f'File upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def generate_thumbnail(image_path, size=(300, 300)):
    """
    Generate a thumbnail for an uploaded image

    Args:
        image_path: Path to the original image
        size: Tuple of (width, height) for thumbnail

    Returns:
        URL of the generated thumbnail
    """
    try:
        # Open the image
        with default_storage.open(image_path, 'rb') as f:
            img = Image.open(f)

            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background

            # Generate thumbnail
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Save thumbnail
            thumb_io = BytesIO()
            img.save(thumb_io, format='JPEG', quality=85)
            thumb_io.seek(0)

            # Generate thumbnail path
            dir_name, file_name = os.path.split(image_path)
            name, ext = os.path.splitext(file_name)
            thumb_path = os.path.join(dir_name, 'thumbnails', f"{name}_thumb.jpg")

            # Save thumbnail
            saved_thumb = default_storage.save(thumb_path, ContentFile(thumb_io.read()))
            return default_storage.url(saved_thumb)

    except Exception as e:
        print(f"Thumbnail generation failed: {e}")
        return None


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses=OpenApiTypes.OBJECT,
    description='Delete a previously uploaded message attachment.'
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_message_attachment(request, message_id):
    """
    Delete a message attachment

    DELETE /api/messaging/upload/{message_id}/

    Only the sender can delete their attachments
    """
    try:
        message = ChatMessage.objects.select_related('conversation').get(id=message_id, sender=request.user)
        conversation = _conversation_with_branch_scope(message.conversation_id, request)
        if conversation is None:
            return Response(
                {'error': 'Message not found or not owned by you'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not message.attachment_url:
            return Response(
                {'error': 'Message has no attachment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete file from storage
        try:
            # Extract file path from URL
            file_path = message.attachment_url.replace(default_storage.base_url, '')
            if default_storage.exists(file_path):
                default_storage.delete(file_path)

            # Delete thumbnail if exists
            if message.attachment_type == 'image':
                dir_name, file_name = os.path.split(file_path)
                name, ext = os.path.splitext(file_name)
                thumb_path = os.path.join(dir_name, 'thumbnails', f"{name}_thumb.jpg")
                if default_storage.exists(thumb_path):
                    default_storage.delete(thumb_path)

        except Exception as e:
            print(f"File deletion failed: {e}")

        # Clear attachment fields
        message.attachment_url = None
        message.attachment_type = None
        message.attachment_name = None
        message.attachment_size = None
        message.content = "[Attachment deleted]"
        message.save()

        return Response({'success': True}, status=status.HTTP_200_OK)

    except ChatMessage.DoesNotExist:
        return Response(
            {'error': 'Message not found or not owned by you'},
            status=status.HTTP_404_NOT_FOUND
        )
