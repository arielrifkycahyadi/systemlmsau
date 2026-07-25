import axios from 'axios';

export const youtubeService = {
  async fetchVideosForQuery(query, customApiKey = null) {
    const apiKey = process.env.YOUTUBE_API_KEY || customApiKey;

    if (!apiKey) {
      // Returns search search query query matches
      return this.getMockVideos(query);
    }

    try {
      const url = 'https://www.googleapis.com/youtube/v3/search';
      const response = await axios.get(url, {
        params: {
          part: 'snippet',
          maxResults: 2,
          q: query,
          type: 'video',
          key: apiKey
        }
      });

      const items = response.data.items || [];
      return items.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url || `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
      }));
    } catch (err) {
      console.warn(`YouTube API query failed for: "${query}". Falling back to mock references.`, err.message);
      return this.getMockVideos(query);
    }
  },

  getMockVideos(query) {
    // Generate fallback youtube simulation items
    const encoded = encodeURIComponent(query);
    return [
      {
        videoId: 'dQw4w9WgXcQ', // Dummy ID
        title: `Introduction tutorial on: ${query}`,
        thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&fit=crop&q=60',
        searchUrl: `https://www.youtube.com/results?search_query=${encoded}`
      },
      {
        videoId: '3JZ_D3K6Lg0', // Dummy ID
        title: `Advanced study course review: ${query}`,
        thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&fit=crop&q=60',
        searchUrl: `https://www.youtube.com/results?search_query=${encoded}`
      }
    ];
  }
};
