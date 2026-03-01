"""
Video Service for YouTube and Local Video Support
"""

import re
import requests
from typing import Dict, Any, Optional
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class VideoService:
    """
    Video service supporting YouTube, Vimeo, and local videos
    """

    def __init__(self):
        self.youtube_api_key = getattr(settings, 'YOUTUBE_API_KEY', None)

    def parse_video_url(self, url: str) -> Dict[str, Any]:
        """
        Parse video URL and extract provider and video ID

        Args:
            url: Video URL (YouTube, Vimeo, or local)

        Returns:
            Dict with provider, video_id, embed_url, thumbnail_url
        """
        if not url:
            return {'error': 'No URL provided'}

        # YouTube patterns
        youtube_patterns = [
            r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
            r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
            r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
        ]

        # Vimeo pattern
        vimeo_pattern = r'(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)'

        # Check YouTube
        for pattern in youtube_patterns:
            match = re.search(pattern, url)
            if match:
                video_id = match.group(1)
                return {
                    'provider': 'youtube',
                    'video_id': video_id,
                    'embed_url': f'https://www.youtube.com/embed/{video_id}',
                    'thumbnail_url': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                    'watch_url': f'https://www.youtube.com/watch?v={video_id}'
                }

        # Check Vimeo
        match = re.search(vimeo_pattern, url)
        if match:
            video_id = match.group(1)
            return {
                'provider': 'vimeo',
                'video_id': video_id,
                'embed_url': f'https://player.vimeo.com/video/{video_id}',
                'thumbnail_url': self._get_vimeo_thumbnail(video_id),
                'watch_url': f'https://vimeo.com/{video_id}'
            }

        # Assume local video
        if url.startswith('/') or url.startswith('http'):
            return {
                'provider': 'local',
                'video_id': None,
                'embed_url': url,
                'thumbnail_url': None,
                'watch_url': url
            }

        return {'error': 'Unsupported video URL format'}

    def get_video_metadata(self, url: str) -> Dict[str, Any]:
        """
        Get video metadata including duration, title, description

        Args:
            url: Video URL

        Returns:
            Dict with metadata
        """
        video_info = self.parse_video_url(url)

        if 'error' in video_info:
            return video_info

        provider = video_info['provider']
        video_id = video_info['video_id']

        if provider == 'youtube' and self.youtube_api_key:
            return self._get_youtube_metadata(video_id)
        elif provider == 'vimeo':
            return self._get_vimeo_metadata(video_id)
        else:
            return video_info

    def _get_youtube_metadata(self, video_id: str) -> Dict[str, Any]:
        """Get YouTube video metadata using API"""
        if not self.youtube_api_key:
            logger.warning("YouTube API key not configured")
            return {
                'provider': 'youtube',
                'video_id': video_id,
                'title': 'YouTube Video',
                'duration_seconds': 0
            }

        try:
            url = f'https://www.googleapis.com/youtube/v3/videos?id={video_id}&key={self.youtube_api_key}&part=snippet,contentDetails,statistics'
            response = requests.get(url, timeout=5)
            data = response.json()

            if 'items' in data and len(data['items']) > 0:
                item = data['items'][0]
                snippet = item.get('snippet', {})
                content_details = item.get('contentDetails', {})
                statistics = item.get('statistics', {})

                # Parse ISO 8601 duration (PT15M33S -> 933 seconds)
                duration_str = content_details.get('duration', 'PT0S')
                duration_seconds = self._parse_iso_duration(duration_str)

                return {
                    'provider': 'youtube',
                    'video_id': video_id,
                    'title': snippet.get('title', ''),
                    'description': snippet.get('description', ''),
                    'thumbnail_url': snippet.get('thumbnails', {}).get('maxres', {}).get('url') or
                                   snippet.get('thumbnails', {}).get('high', {}).get('url'),
                    'duration_seconds': duration_seconds,
                    'view_count': int(statistics.get('viewCount', 0)),
                    'channel_title': snippet.get('channelTitle', ''),
                    'published_at': snippet.get('publishedAt', ''),
                    'embed_url': f'https://www.youtube.com/embed/{video_id}',
                    'watch_url': f'https://www.youtube.com/watch?v={video_id}'
                }

        except Exception as e:
            logger.error(f"Error fetching YouTube metadata: {str(e)}")

        return {
            'provider': 'youtube',
            'video_id': video_id,
            'error': 'Failed to fetch metadata'
        }

    def _get_vimeo_metadata(self, video_id: str) -> Dict[str, Any]:
        """Get Vimeo video metadata using oEmbed API"""
        try:
            url = f'https://vimeo.com/api/oembed.json?url=https://vimeo.com/{video_id}'
            response = requests.get(url, timeout=5)
            data = response.json()

            return {
                'provider': 'vimeo',
                'video_id': video_id,
                'title': data.get('title', ''),
                'description': data.get('description', ''),
                'thumbnail_url': data.get('thumbnail_url', ''),
                'duration_seconds': data.get('duration', 0),
                'author_name': data.get('author_name', ''),
                'embed_url': f'https://player.vimeo.com/video/{video_id}',
                'watch_url': f'https://vimeo.com/{video_id}'
            }

        except Exception as e:
            logger.error(f"Error fetching Vimeo metadata: {str(e)}")

        return {
            'provider': 'vimeo',
            'video_id': video_id,
            'error': 'Failed to fetch metadata'
        }

    def _get_vimeo_thumbnail(self, video_id: str) -> Optional[str]:
        """Get Vimeo thumbnail URL"""
        try:
            metadata = self._get_vimeo_metadata(video_id)
            return metadata.get('thumbnail_url')
        except:
            return None

    def _parse_iso_duration(self, duration: str) -> int:
        """
        Parse ISO 8601 duration to seconds
        Example: PT1H2M30S -> 3750 seconds
        """
        if not duration or duration == 'PT0S':
            return 0

        # Remove PT prefix
        duration = duration.replace('PT', '')

        hours = 0
        minutes = 0
        seconds = 0

        # Extract hours
        if 'H' in duration:
            hours_str = duration.split('H')[0]
            hours = int(hours_str)
            duration = duration.split('H')[1]

        # Extract minutes
        if 'M' in duration:
            minutes_str = duration.split('M')[0]
            minutes = int(minutes_str)
            duration = duration.split('M')[1]

        # Extract seconds
        if 'S' in duration:
            seconds_str = duration.split('S')[0]
            seconds = int(seconds_str)

        return hours * 3600 + minutes * 60 + seconds

    def generate_embed_html(
        self,
        url: str,
        width: int = 640,
        height: int = 360,
        autoplay: bool = False,
        controls: bool = True
    ) -> str:
        """
        Generate HTML embed code for video

        Args:
            url: Video URL
            width: Video width in pixels
            height: Video height in pixels
            autoplay: Auto-play video
            controls: Show video controls

        Returns:
            HTML embed code
        """
        video_info = self.parse_video_url(url)

        if 'error' in video_info:
            return f'<p>Error: {video_info["error"]}</p>'

        provider = video_info['provider']
        embed_url = video_info['embed_url']

        if provider == 'youtube':
            params = []
            if autoplay:
                params.append('autoplay=1')
            if not controls:
                params.append('controls=0')

            param_str = '&'.join(params)
            if param_str:
                embed_url += f'?{param_str}'

            return f'''
<iframe
    width="{width}"
    height="{height}"
    src="{embed_url}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
></iframe>
            '''

        elif provider == 'vimeo':
            params = []
            if autoplay:
                params.append('autoplay=1')

            param_str = '&'.join(params)
            if param_str:
                embed_url += f'?{param_str}'

            return f'''
<iframe
    width="{width}"
    height="{height}"
    src="{embed_url}"
    frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen
></iframe>
            '''

        else:  # local video
            return f'''
<video
    width="{width}"
    height="{height}"
    {'autoplay' if autoplay else ''}
    {'controls' if controls else ''}
>
    <source src="{embed_url}" type="video/mp4">
    Your browser does not support the video tag.
</video>
            '''


# Global instance
video_service = VideoService()


def parse_video_url(url: str) -> Dict[str, Any]:
    """Convenience function to parse video URL"""
    return video_service.parse_video_url(url)


def get_video_metadata(url: str) -> Dict[str, Any]:
    """Convenience function to get video metadata"""
    return video_service.get_video_metadata(url)


def generate_embed_html(url: str, **kwargs) -> str:
    """Convenience function to generate embed HTML"""
    return video_service.generate_embed_html(url, **kwargs)
